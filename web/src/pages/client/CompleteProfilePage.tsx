import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { send } from '../../lib/api'
import { useAuth } from '../../auth/AuthContext'
import { Field, FormError, fieldError } from '../../components/ui'
import type { AuthUser } from '../../types'
import { AuthLayout } from '../auth/AuthLayout'

/**
 * Primera vez que un huésped entra con Google: el nombre y el correo vienen de Google;
 * él completa su DNI y teléfono para poder reservar.
 */
export function CompleteProfilePage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ document_number: '', phone: '' })

  const save = useMutation({
    mutationFn: () => send<AuthUser>('put', '/portal/profile', form),
    onSuccess: (updated) => {
      updateUser(updated)
      navigate('/reservar', { replace: true })
    },
  })

  if (user?.client) return <Navigate to="/reservar" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)

  return (
    <AuthLayout heading="Un paso más y reservas" lede="Con tu DNI y teléfono recepción te identifica al llegar y te avisa si algo cambia en tu reserva.">
      <div>
        <h1>Completa tus datos</h1>
        <p className="muted">Solo te lo pedimos esta vez.</p>
      </div>
      <FormError error={save.error} />
      <form onSubmit={submit} className="stack" style={{ gap: 14 }} noValidate>
        <Field label="Nombre" value={user?.name ?? ''} readOnly hint="Viene de tu cuenta de Google." />
        <Field label="Correo" type="email" value={user?.email ?? ''} readOnly />
        <Field label="DNI" inputMode="numeric" autoComplete="off" required value={form.document_number} placeholder="8 dígitos"
          onChange={(e) => setForm({ ...form, document_number: digits(e.target.value, 8) })} error={fieldError(save.error, 'document_number')} />
        <Field label="Teléfono" type="tel" inputMode="numeric" autoComplete="tel" required value={form.phone} placeholder="9 dígitos"
          onChange={(e) => setForm({ ...form, phone: digits(e.target.value, 9) })} error={fieldError(save.error, 'phone')} />
        <button className="btn btn-primary" type="submit" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </form>
    </AuthLayout>
  )
}
