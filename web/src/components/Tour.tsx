import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { send } from '../lib/api'
import { t } from '../lib/i18n'
import { tourStore, useTourActive, useTourModo } from '../lib/tour'
import { tutorialDe } from '../lib/tutoriales'
import type { AuthUser } from '../types'
import { Modal } from './ui'

interface Step {
  /** Selector de lo que se resalta; sin selector, la burbuja va al centro con toda la pantalla oscurecida. */
  target?: string
  title: string
  text: string
}

/** Pasos según lo que ve cada rol: solo se muestran los que tienen algo en pantalla. */
function stepsFor(user: AuthUser): Step[] {
  const is = (role: string) => user.roles.includes(role as AuthUser['roles'][number])
  const firstName = user.name.split(' ')[0]
  const steps: Step[] = [
    {
      title: t('Hola, {name}', { name: firstName }),
      text: t('En un minuto te mostramos dónde está cada cosa. Usa Siguiente o las flechas del teclado; con Esc sales cuando quieras.'),
    },
  ]

  if (is('client')) {
    steps.push(
      { target: '[data-tour="/reservar"]', title: t('Reservar'), text: t('Elige tus fechas y cuántos huéspedes son: verás las habitaciones libres con su precio total y reservas en un clic.') },
      { target: '[data-tour="/mis-reservas"]', title: t('Mis reservas'), text: t('Aquí ves el estado de cada reserva y puedes cancelar las que aún no empiezan.') },
      { target: '[data-tour="/perfil"]', title: t('Mi perfil'), text: t('Tu nombre, DNI y celular. Son necesarios para reservar; puedes agregarlos o cambiarlos cuando quieras.') },
    )
  } else {
    steps.push(
      { target: '[data-tour-group="Inicio"]', title: t('Panel'), text: t('El resumen del día: ocupación, llegadas y salidas, y el tablero de habitaciones por piso.') },
      { target: '[data-tour-group="Recepción"]', title: t('Recepción'), text: t('Reservas, check-in y check-out, habitaciones, clientes y cochera: el trabajo diario del mostrador.') },
      { target: '[data-tour-group="Almacén"]', title: t('Almacén'), text: t('Insumos y movimientos de inventario. Avisa cuando algo queda bajo el mínimo.') },
      {
        target: '[data-tour-group="Administración"]',
        title: t('Administración'),
        text: is('admin')
          ? t('Personal, cuentas y roles, reportes, auditoría y facturación.')
          : t('Desde aquí registras las cuentas del personal del hotel.'),
      },
      { target: '[data-tour-group="Programador"]', title: t('Vista del programador'), text: t('Salud del sistema, errores recientes y registros de peticiones.') },
    )
  }

  steps.push(
    { target: '[data-tour="/configuracion"]', title: t('Configuración'), text: t('Cambia entre modo claro y oscuro, el idioma, y vuelve a ver este tutorial cuando quieras.') },
    { target: '[data-tour="cuenta"]', title: t('Tu cuenta'), text: t('Aquí ves con qué cuenta entraste y cierras sesión al terminar.') },
    { title: t('¡Listo!'), text: t('Ya conoces lo principal. Si lo necesitas, el tutorial está en Configuración.') },
  )

  // En el teléfono el menú se abre junto con el recorrido: basta con que exista, aunque aún no se vea.
  return steps.filter((step) => !step.target || document.querySelector(step.target))
}

/** Rectángulos en pantalla de lo que coincide con el selector (los ocultos no cuentan). */
function visibleRects(selector: string): DOMRect[] {
  return [...document.querySelectorAll(selector)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
}

interface Box { top: number; left: number; width: number; height: number }

const PAD = 6
const BUBBLE_WIDTH = 320
const GAP = 14

function unionBox(selector: string): Box | null {
  const rects = visibleRects(selector)
  if (rects.length === 0) return null
  const top = Math.min(...rects.map((r) => r.top)) - PAD
  const left = Math.min(...rects.map((r) => r.left)) - PAD
  const bottom = Math.max(...rects.map((r) => r.bottom)) + PAD
  const right = Math.max(...rects.map((r) => r.right)) + PAD
  return { top, left, width: right - left, height: bottom - top }
}

/** La burbuja va a la derecha de lo resaltado si cabe; si no, debajo o encima. Nunca se sale de la ventana. */
function bubblePosition(box: Box | null, bubbleHeight: number): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(BUBBLE_WIDTH, vw - 32)
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - width - 16)
  const clampY = (y: number) => Math.min(Math.max(16, y), vh - bubbleHeight - 16)
  if (!box) return { top: clampY((vh - bubbleHeight) / 2), left: clampX((vw - width) / 2) }
  if (box.left + box.width + GAP + width <= vw - 16) return { top: clampY(box.top), left: box.left + box.width + GAP }
  if (box.top + box.height + GAP + bubbleHeight <= vh - 16) return { top: box.top + box.height + GAP, left: clampX(box.left) }
  return { top: clampY(box.top - GAP - bubbleHeight), left: clampX(box.left) }
}

/**
 * Cierra el recorrido. Si era el tutorial general, además guarda en la cuenta que ya lo vio
 * (el de cada pantalla se puede repetir siempre, así que ese no se guarda).
 */
function useFinishTutorial(general = true) {
  const { user, updateUser } = useAuth()
  return useCallback(
    (outcome: 'completed' | 'skipped') => {
      tourStore.stop()
      if (!user || !general) return
      updateUser({ ...user, tutorial_seen: true })
      send<AuthUser>('post', '/auth/tutorial', { outcome }).then(updateUser).catch(() => {
        /* si falla, se le volverá a ofrecer la próxima vez que entre */
      })
    },
    [user, updateUser, general],
  )
}

/** Aviso del primer ingreso: hacer el tutorial ahora u omitirlo. */
export function TourPrompt() {
  const { user } = useAuth()
  const active = useTourActive()
  const finish = useFinishTutorial()
  const [later, setLater] = useState(false)
  if (!user || user.tutorial_seen !== false || active || later) return null

  return (
    <Modal
      open
      title={t('¿Quieres hacer el tutorial?')}
      onClose={() => setLater(true)}
      footer={
        <>
          <button className="btn" onClick={() => finish('skipped')}>{t('Omitir')}</button>
          <button className="btn btn-primary" autoFocus onClick={() => tourStore.start()}>{t('Hacer el tutorial')}</button>
        </>
      }
    >
      <p>{t('Es un recorrido corto por las secciones que puedes usar. Si lo omites, lo encuentras después en Configuración.')}</p>
    </Modal>
  )
}

/**
 * Recorrido guiado: oscurece la pantalla y resalta cada parte (menú, configuración, cuenta) con una burbuja
 * que explica para qué sirve. Teclado: flechas para avanzar o volver, Esc para salir.
 */
export function Tour() {
  const modo = useTourModo()
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!modo || !user) return null
  // El tutorial general recorre las secciones del menú; el de la pantalla, sus propios botones.
  const steps = modo === 'general' ? stepsFor(user) : (tutorialDe(pathname) ?? []).filter((s) => !s.target || document.querySelector(s.target))
  if (steps.length === 0) return null
  return createPortal(<TourSteps steps={steps} general={modo === 'general'} />, document.body)
}

function TourSteps({ steps: pasos, general }: { steps: Step[]; general: boolean }) {
  const finish = useFinishTutorial(general)
  const [steps] = useState(() => pasos)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [bubbleHeight, setBubbleHeight] = useState(180)
  const bubble = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  // Mide lo resaltado (y lo vuelve a medir si cambia el tamaño de la ventana o se desplaza la página).
  useLayoutEffect(() => {
    const measure = () => setBox(step.target ? unionBox(step.target) : null)
    if (step.target) document.querySelector(step.target)?.scrollIntoView?.({ block: 'nearest' })
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step])

  useLayoutEffect(() => {
    if (bubble.current) setBubbleHeight(bubble.current.offsetHeight)
  }, [index])

  useEffect(() => primary.current?.focus(), [index])

  // Mientras dura, el resto de la página no recibe foco ni clics.
  useEffect(() => {
    const others = [...document.body.children].filter((el) => el !== root.current)
    others.forEach((el) => el.setAttribute('inert', ''))
    return () => others.forEach((el) => el.removeAttribute('inert'))
  }, [])

  const next = () => (last ? finish('completed') : setIndex(index + 1))
  const back = () => setIndex(Math.max(0, index - 1))

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish('skipped')
    else if (e.key === 'ArrowRight') next()
    else if (e.key === 'ArrowLeft') back()
  }

  const position = bubblePosition(box, bubbleHeight)

  return (
    <div className="tour" ref={root} onKeyDown={onKeyDown}>
      {box ? (
        <div className="tour-spotlight" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div
        ref={bubble}
        className="tour-bubble"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        style={{ top: position.top, left: position.left }}
      >
        <span className="small muted" aria-live="polite">{t('Paso {n} de {total}', { n: index + 1, total: steps.length })}</span>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-text">{step.text}</p>
        <div className="tour-progress" aria-hidden="true">
          {steps.map((_, i) => <i key={i} className={i === index ? 'on' : ''} />)}
        </div>
        <div className="tour-actions">
          {!last && <button className="btn btn-ghost btn-sm" onClick={() => finish('skipped')}>{t('Salir')}</button>}
          <span style={{ flex: 1 }} />
          {index > 0 && <button className="btn btn-sm" onClick={back}>{t('Anterior')}</button>}
          <button ref={primary} className="btn btn-primary btn-sm" onClick={next}>{last ? t('Terminar') : t('Siguiente')}</button>
        </div>
      </div>
    </div>
  )
}
