import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { API_URL } from '../../lib/api'
import { t } from '../../lib/i18n'

function StatusScreen({ code, title, children, full }: { code: string; title: string; children: ReactNode; full?: boolean }) {
  useEffect(() => {
    document.title = `${title} · LeGrandHotel`
  }, [title])
  return (
    <main className={`status-screen ${full ? 'full' : ''}`}>
      <div className="status-code" aria-hidden="true">{code}</div>
      <div className="status-copy enter">{children}</div>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <StatusScreen code="404" title={t('Página no encontrada')} full>
      <h1>{t('Esta habitación no existe')}</h1>
      <p>{t('La dirección que abriste no corresponde a ninguna pantalla de LeGrandHotel. Revisa el enlace o vuelve al inicio.')}</p>
      <div className="actions">
        <Link className="btn btn-primary" to="/">{t('Ir al inicio')}</Link>
        <button className="btn" onClick={() => window.history.back()}>{t('Volver atrás')}</button>
      </div>
    </StatusScreen>
  )
}

export function UnderConstructionPage({ module = t('Este módulo') }: { module?: string }) {
  return (
    <StatusScreen code="…" title={t('En construcción')}>
      <h1>{t('{module} está en construcción', { module })}</h1>
      <p>{t('Lo estamos terminando para la próxima entrega. Mientras tanto, el resto de módulos funciona con normalidad.')}</p>
      <div className="actions">
        <Link className="btn btn-primary" to="/">{t('Volver al panel')}</Link>
      </div>
    </StatusScreen>
  )
}

export function ForbiddenPage() {
  return (
    <StatusScreen code="403" title={t('Sin permiso')}>
      <h1>{t('No tienes acceso a esta sección')}</h1>
      <p>{t('Tu rol no permite ver esta pantalla, aunque escribas la dirección a mano. Si crees que deberías tener acceso, pídeselo al administrador.')}</p>
      <div className="actions">
        <Link className="btn btn-primary" to="/">{t('Ir a mi inicio')}</Link>
      </div>
    </StatusScreen>
  )
}

export function SessionExpiredPage() {
  return (
    <StatusScreen code="401" title={t('Sesión expirada')} full>
      <h1>{t('Tu sesión expiró')}</h1>
      <p>{t('Por seguridad, las sesiones duran 60 minutos sin renovarse. Vuelve a iniciar sesión para continuar donde estabas.')}</p>
      <div className="actions">
        <Link className="btn btn-primary" to="/login">{t('Iniciar sesión')}</Link>
      </div>
    </StatusScreen>
  )
}

export function ServerErrorPage() {
  const [params] = useSearchParams()
  const incident = params.get('incidente')
  return (
    <StatusScreen code="500" title={t('Error del servidor')} full>
      <h1>{t('El servidor tuvo un problema')}</h1>
      <p>{t('No es algo que hayas hecho tú. El error quedó registrado y el equipo lo revisará.')}</p>
      {incident && <p className="meta">{t('Código de incidente:')} <span className="mono">{incident}</span></p>}
      <div className="actions">
        <button className="btn btn-primary" onClick={() => window.history.back()}>{t('Reintentar')}</button>
        <Link className="btn" to="/">{t('Ir al inicio')}</Link>
      </div>
    </StatusScreen>
  )
}

/** 503: muestra el motivo y consulta /health cada 30 s hasta que el servicio vuelve. */
export function ServiceUnavailablePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reason = params.get('motivo') ?? t('El servicio no está disponible en este momento.')
  const interval = Math.max(Number(params.get('reintento') ?? 30), 5)
  const [left, setLeft] = useState(interval)

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((s) => (s <= 1 ? interval : s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [interval])

  useEffect(() => {
    if (left !== interval) return
    let cancelled = false
    fetch(`${API_URL}/health`, { headers: { Accept: 'application/json' } })
      .then((r) => {
        if (r.ok && !cancelled) navigate(-1)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [left, interval, navigate])

  return (
    <StatusScreen code="503" title={t('Servicio no disponible')} full>
      <h1>{t('Servicio no disponible')}</h1>
      <p>{reason}</p>
      <p className="meta num" aria-live="polite">{t('Reintentando automáticamente en {seconds} s.', { seconds: left })}</p>
      <div className="actions">
        <button className="btn btn-primary" onClick={() => navigate(-1)}>{t('Reintentar ahora')}</button>
      </div>
    </StatusScreen>
  )
}

/** 429: cuenta regresiva según la cabecera Retry-After. */
export function TooManyRequestsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [left, setLeft] = useState(Math.max(Number(params.get('espera') ?? 60), 1))

  useEffect(() => {
    if (left <= 0) return
    const timer = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left])

  return (
    <StatusScreen code="429" title={t('Demasiadas peticiones')} full>
      <h1>{t('Vas demasiado rápido')}</h1>
      <p>{t('Para proteger el sistema limitamos las peticiones por minuto. Podrás continuar en unos segundos.')}</p>
      <p className="meta num" aria-live="polite">{left > 0 ? t('Espera {seconds} s', { seconds: left }) : t('Ya puedes continuar.')}</p>
      <div className="actions">
        <button className="btn btn-primary" disabled={left > 0} onClick={() => navigate(-1)}>{t('Continuar')}</button>
      </div>
    </StatusScreen>
  )
}

export function OfflineScreen() {
  return (
    <StatusScreen code="—" title={t('Sin conexión')} full>
      <h1>{t('Sin conexión a internet')}</h1>
      <p>{t('Tu equipo perdió la conexión. Cuando vuelva, esta pantalla se cerrará sola y podrás seguir; los datos que no se guardaron no se perdieron del formulario.')}</p>
      <p className="meta">{t('Revisa el wifi o el cable de red de la recepción.')}</p>
    </StatusScreen>
  )
}
