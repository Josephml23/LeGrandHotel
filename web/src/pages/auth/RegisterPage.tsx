import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { API_URL, send } from '../../lib/api'
import { useAuth } from '../../auth/AuthContext'
import { Field, FormError, SelectField, fieldError } from '../../components/ui'
import type { Session } from '../../types'
import { AuthLayout } from './AuthLayout'

const EMPTY = {
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  document_type: 'DNI',
  document_number: '',
  phone: '',
  nationality: 'Perú',
}

/** Registro público de huéspedes: crea la cuenta con rol Cliente y su ficha. */
export function RegisterPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  const register = useMutation({
    mutationFn: () => send<Session>('post', '/auth/register', form),
    onSuccess: (session) => {
      setSession(session)
      navigate('/verificar-correo', { replace: true })
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    register.mutate()
  }

  const err = (name: string) => fieldError(register.error, name)

  return (
    <AuthLayout wide heading="Reserva tu habitación en minutos" lede="Crea tu cuenta de huésped, verifica tu correo y elige las fechas.">
      <div>
        <h1>Crear cuenta de huésped</h1>
        <p className="muted">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </div>
      <FormError error={register.error} />
      <form onSubmit={submit} className="form-grid" noValidate>
        <Field className="full" label="Nombre completo" autoComplete="name" required value={form.name} onChange={set('name')} error={err('name')} />
        <Field className="full" label="Correo" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={err('email')} />
        <Field label="Contraseña" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')}
          error={err('password')} hint="Mínimo 8 caracteres, con letras y números." />
        <Field label="Repite la contraseña" type="password" autoComplete="new-password" required value={form.password_confirmation}
          onChange={set('password_confirmation')} />
        <SelectField label="Documento" value={form.document_type} onChange={set('document_type')} error={err('document_type')}
          options={[{ value: 'DNI', label: 'DNI' }, { value: 'PASAPORTE', label: 'Pasaporte' }, { value: 'CE', label: 'Carné de extranjería' }]} />
        <Field label="Número de documento" required value={form.document_number} onChange={set('document_number')} error={err('document_number')} />
        <Field label="Teléfono" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={err('phone')} />
        <Field label="Nacionalidad" autoComplete="country-name" value={form.nationality} onChange={set('nationality')} error={err('nationality')} />
        <button className="btn btn-primary full" type="submit" disabled={register.isPending}>
          {register.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <span className="divider-text">o</span>
      <a className="btn" href={`${API_URL}/auth/google/redirect`}>Registrarme con Google</a>
    </AuthLayout>
  )
}
