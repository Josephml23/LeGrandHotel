import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { send } from '../../lib/api'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toasts'
import { Field, FormError, SelectField, TitleRow, fieldError } from '../../components/ui'
import { ROLE_LABELS, type AuthUser, type RoleName } from '../../types'
import { t } from '../../lib/i18n'

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
      toast(t('Cuenta creada para {name}. Le llegó un correo para verificarla.', { name: user.name }))
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
      <TitleRow title={t('Registrar personal')} lede={t('Crea la cuenta de una persona del hotel con su rol. Los huéspedes no se registran aquí: crean su cuenta con Google.')}>
        {isAdmin && <Link className="btn" to="/usuarios">{t('Ver usuarios')}</Link>}
      </TitleRow>
      <form onSubmit={submit} className="form-grid" style={{ maxWidth: 640 }} noValidate>
        <div className="full"><FormError error={register.error} /></div>
        <Field className="full" label={t('Nombre completo')} autoComplete="off" required value={form.name} onChange={set('name')} error={err('name')} />
        <Field className="full" label={t('Correo')} type="email" autoComplete="off" required value={form.email} onChange={set('email')} error={err('email')} />
        <Field label={t('Contraseña inicial')} type="password" autoComplete="new-password" required value={form.password} onChange={set('password')}
          error={err('password')} hint={t('Mínimo 8 caracteres, con letras y números.')} />
        <Field label={t('Repite la contraseña')} type="password" autoComplete="new-password" required value={form.password_confirmation}
          onChange={set('password_confirmation')} />
        <SelectField className="full" label={t('Rol')} value={form.role} onChange={set('role')} error={err('role')}
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          hint={t('El hotel tiene un solo Programador: no se crean cuentas nuevas con ese rol.')} />
        <div className="full">
          <button className="btn btn-primary" type="submit" disabled={register.isPending}>
            {register.isPending ? t('Registrando…') : t('Registrar cuenta')}
          </button>
        </div>
      </form>
    </>
  )
}
