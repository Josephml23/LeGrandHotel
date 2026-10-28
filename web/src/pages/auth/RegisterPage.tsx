import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { send } from '../../lib/api'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toasts'
import { Field, FormError, SelectField, TitleRow, fieldError } from '../../components/ui'
import { ROLE_LABELS, type AuthUser, type RoleName } from '../../types'

const EMPTY = { name: '', email: '', password: '', password_confirmation: '', role: 'receptionist' as RoleName }

/**
 * Registro de personal: el Administrador y el Programador crean cuentas de Recepción, Administración y Almacén.
 * No se crean Programadores (solo existe uno) ni clientes (entran con Google).
 */
const ROLES: RoleName[] = ['receptionist', 'storekeeper', 'admin']

export function RegisterPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')
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
      <TitleRow title="Registrar personal" lede="Crea la cuenta de una persona del hotel con su rol. Los huéspedes no se registran aquí: crean su cuenta con Google.">
        {isAdmin && <Link className="btn" to="/usuarios">Ver usuarios</Link>}
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
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          hint="El hotel tiene un solo Programador: no se crean cuentas nuevas con ese rol." />
        <div className="full">
          <button className="btn btn-primary" type="submit" disabled={register.isPending}>
            {register.isPending ? 'Registrando…' : 'Registrar cuenta'}
          </button>
        </div>
      </form>
    </>
  )
}
