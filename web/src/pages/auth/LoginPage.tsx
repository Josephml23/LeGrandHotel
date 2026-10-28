import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { API_URL, ApiError, send } from '../../lib/api'
import { t } from '../../lib/i18n'
import { homeFor, useAuth } from '../../auth/AuthContext'
import { Field, FormError, fieldError } from '../../components/ui'
import type { Session } from '../../types'
import { AuthLayout } from './AuthLayout'

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'No se pudo iniciar sesión con Google. Intenta de nuevo.',
  google_personal: 'Ese correo pertenece al personal del hotel. Ingresa con tu correo y contraseña.',
}

/** Segundos que faltan para `until` (0 si ya pasó). */
const secondsLeft = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / 1000))

/** La espera sobrevive a un cambio de idioma o a recargar la pestaña. */
const LOCK_KEY = 'lgh.login-espera'
const savedLock = (): number => {
  try {
    return Number(sessionStorage.getItem(LOCK_KEY)) || 0
  } catch {
    return 0
  }
}
const saveLock = (until: number) => {
  try {
    sessionStorage.setItem(LOCK_KEY, String(until))
  } catch {
    /* sin almacenamiento: la espera dura lo que dure la pantalla */
  }
}

/**
 * Una sola pantalla con dos entradas: el personal usa correo y contraseña;
 * los huéspedes entran (y se registran la primera vez) con Google.
 * Tras una contraseña incorrecta la API pide esperar (30 s, 1 min, 2 min…): se muestra la cuenta regresiva.
 */
export function LoginPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [lockedUntil, setLockedUntil] = useState(savedLock)
  const [remaining, setRemaining] = useState(() => secondsLeft(savedLock()))
  const googleKey = params.get('error') ?? ''
  const googleError = GOOGLE_ERRORS[googleKey] ? t(GOOGLE_ERRORS[googleKey]) : undefined

  const login = useMutation({
    mutationFn: () => send<Session>('post', '/auth/login', form),
    onSuccess: (session) => {
      setSession(session)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : homeFor(session.user), { replace: true })
    },
    onError: (error) => {
      const wait = error instanceof ApiError ? Number(error.details?.retry_after ?? 0) : 0
      if (wait > 0) {
        const until = Date.now() + wait * 1000
        saveLock(until)
        setLockedUntil(until)
        setRemaining(wait)
      }
    },
  })

  // Cuenta regresiva: el botón se habilita cuando termina la espera.
  useEffect(() => {
    if (!lockedUntil) return
    const timer = window.setInterval(() => {
      const left = secondsLeft(lockedUntil)
      setRemaining(left)
      if (left === 0) window.clearInterval(timer)
    }, 500)
    return () => window.clearInterval(timer)
  }, [lockedUntil])

  const locked = remaining > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!locked) login.mutate()
  }

  return (
    <AuthLayout heading={t('Tu habitación, a un clic')} lede={t('Los huéspedes reservan en línea; el personal gestiona recepción, cochera e inventario de LeGrandHotel.')}>
      <div>
        <h1>{t('Iniciar sesión')}</h1>
        <p className="muted">{t('Personal del hotel: ingresa con tu correo y contraseña.')}</p>
      </div>
      {googleError && <div className="form-error" role="alert">{googleError}</div>}
      {/* Durante la espera basta con la cuenta regresiva; el mensaje de la API diría lo mismo. */}
      {!(locked && login.error instanceof ApiError && login.error.code === 'LOGIN_LOCKED') && <FormError error={login.error} />}
      {locked && (
        <div className="form-warning" role="status" aria-live="polite">
          {t('Por seguridad, espera {seconds} s antes de volver a intentar. Cada intento fallido alarga la espera.', { seconds: remaining })}
        </div>
      )}
      <form onSubmit={submit} className="stack" style={{ gap: 14 }} noValidate>
        <Field label={t('Correo')} type="email" autoComplete="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldError(login.error, 'email')} />
        <Field label={t('Contraseña')} type="password" autoComplete="current-password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} error={fieldError(login.error, 'password')} />
        <button className="btn btn-primary" type="submit" disabled={login.isPending || locked}>
          {login.isPending ? t('Ingresando…') : locked ? t('Espera {seconds} s', { seconds: remaining }) : t('Ingresar')}
        </button>
      </form>
      <span className="divider-text">{t('¿Eres huésped?')}</span>
      <a className="btn" href={`${API_URL}/auth/google/redirect`}>{t('Continuar con Google')}</a>
      <p className="muted small">{t('Con Google creas tu cuenta de cliente y reservas en línea. Las cuentas del personal las crea el hotel.')}</p>
    </AuthLayout>
  )
}
