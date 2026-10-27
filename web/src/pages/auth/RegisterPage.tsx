import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { send } from '../../lib/api'
import { useToast } from '../../components/Toasts'
import { Field, FormError, SelectField, TitleRow, fieldError } from '../../components/ui'
import { ROLE_LABELS, type AuthUser, type RoleName } from '../../types'

const EMPTY = { name: '', email: '', password: '', password_confirmation: '', role: 'receptionist' as RoleName }

/**
 * Registro interno: solo el Administrador crea cuentas del personal del hotel.
 * Es una pantalla distinta del login y nadie de afuera puede registrarse.
 */
export function RegisterPage() {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })

  const register = useMutation({
    mutationFn: () => send<AuthUser>('post', '/auth/register', form),
    onSuccess: (user) => {
      toast(`Cuenta creada para ${user.name}. Le llegó un correo para verificarla.`)
      setForm(EMPTY)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    register.mutate()
  }
  const err = (name: string) => fieldError(register.error, name)

  return (
    <>
      <TitleRow title="Registrar usuario" lede="Crea la cuenta de una persona del hotel. Solo el administrador puede registrar cuentas; no existe registro público.">
        <Link className="btn" to="/usuarios">Ver usuarios</Link>
      </TitleRow>
      <form onSubmit={submit} className="form-grid" style={{ maxWidth: 640 }} noValidate>
        <div className="full"><FormError error={register.error} /></div>
        <Field className="full" label="Nombre completo" autoComplete="off" required value={form.name} onChange={set('name')} error={err('name')} />
        <Field className="full" label="Correo" type="email" autoComplete="off" required value={form.email} onChange={set('email')} error={err('email')} />
        <Field label="Contraseña inicial" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')}
          error={err('password')} hint="Mínimo 8 caracteres, con letras y números." />
        <Field label="Repite la contraseña" type="password" autoComplete="new-password" required value={form.password_confirmation}
          onChange={set('password_confirmation')} />
        <SelectField className="full" label="Rol" value={form.role} onChange={set('role')} error={err('role')}
          options={(['receptionist', 'storekeeper', 'developer', 'admin'] as RoleName[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        <div className="full">
          <button className="btn btn-primary" type="submit" disabled={register.isPending}>
            {register.isPending ? 'Registrando…' : 'Registrar usuario'}
          </button>
        </div>
      </form>
    </>
  )
}
