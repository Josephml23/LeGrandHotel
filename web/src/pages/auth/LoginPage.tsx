import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { API_URL, send } from '../../lib/api'
import { homeFor, useAuth } from '../../auth/AuthContext'
import { Field, FormError, fieldError } from '../../components/ui'
import type { Session } from '../../types'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })

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
    <AuthLayout heading="La recepción, en una sola pantalla" lede="Habitaciones, reservas, check-in, cochera e inventario de LeGrandHotel.">
      <div>
        <h1>Iniciar sesión</h1>
        <p className="muted">Sistema interno del personal del hotel.</p>
      </div>
      {params.get('error') === 'google' && <div className="form-error" role="alert">No se pudo iniciar sesión con Google. Intenta de nuevo.</div>}
      {params.get('error') === 'google_sin_cuenta' && <div className="form-error" role="alert">Ese correo de Google no pertenece al personal del hotel. Pide al administrador que registre tu cuenta.</div>}
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
      <span className="divider-text">o</span>
      <a className="btn" href={`${API_URL}/auth/google/redirect`}>Continuar con Google</a>
      <p className="muted small">Acceso solo para el personal del hotel. Las cuentas las crea el administrador.</p>
    </AuthLayout>
  )
}
