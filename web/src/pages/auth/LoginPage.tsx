import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { API_URL, send } from '../../lib/api'
import { homeFor, useAuth } from '../../auth/AuthContext'
import { Field, FormError, fieldError } from '../../components/ui'
import type { Session } from '../../types'
import { AuthLayout } from './AuthLayout'

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'No se pudo iniciar sesión con Google. Intenta de nuevo.',
  google_personal: 'Ese correo pertenece al personal del hotel. Ingresa con tu correo y contraseña.',
}

/**
 * Una sola pantalla con dos entradas: el personal usa correo y contraseña;
 * los huéspedes entran (y se registran la primera vez) con Google.
 */
export function LoginPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const googleError = GOOGLE_ERRORS[params.get('error') ?? '']

  const login = useMutation({
    mutationFn: () => send<Session>('post', '/auth/login', form),
    onSuccess: (session) => {
      setSession(session)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : homeFor(session.user), { replace: true })
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }

  return (
    <AuthLayout heading="Tu habitación, a un clic" lede="Los huéspedes reservan en línea; el personal gestiona recepción, cochera e inventario de LeGrandHotel.">
      <div>
        <h1>Iniciar sesión</h1>
        <p className="muted">Personal del hotel: ingresa con tu correo y contraseña.</p>
      </div>
      {googleError && <div className="form-error" role="alert">{googleError}</div>}
      <FormError error={login.error} />
      <form onSubmit={submit} className="stack" style={{ gap: 14 }} noValidate>
        <Field label="Correo" type="email" autoComplete="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldError(login.error, 'email')} />
        <Field label="Contraseña" type="password" autoComplete="current-password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} error={fieldError(login.error, 'password')} />
        <button className="btn btn-primary" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <span className="divider-text">¿Eres huésped?</span>
      <a className="btn" href={`${API_URL}/auth/google/redirect`}>Continuar con Google</a>
      <p className="muted small">Con Google creas tu cuenta de cliente y reservas en línea. Las cuentas del personal las crea el hotel.</p>
    </AuthLayout>
  )
}
