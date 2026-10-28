import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { send } from '../../lib/api'
import { t } from '../../lib/i18n'
import { profileLater, useAuth } from '../../auth/AuthContext'
import { Field, FormError } from '../../components/ui'
import type { AuthUser } from '../../types'
import { AuthLayout } from '../auth/AuthLayout'
import { ProfileFields, profileFrom, profilePayload } from './ProfileFields'

/**
 * Primera vez que un huésped entra con Google: le ofrecemos dejar su nombre completo, DNI y celular.
 * Es opcional: puede hacerlo después en Mi perfil o al reservar (ahí sí se piden).
 */
export function CompleteProfilePage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => profileFrom(user))

  const save = useMutation({
    mutationFn: () => send<AuthUser>('put', '/portal/profile', profilePayload(form)),
    onSuccess: (updated) => {
      updateUser(updated)
      navigate('/reservar', { replace: true })
    },
  })

  if (user?.client) return <Navigate to="/reservar" replace />

  const later = () => {
    if (user) profileLater.remember(user.id)
    navigate('/reservar', { replace: true })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <AuthLayout heading={t('Bienvenido a LeGrandHotel')} lede={t('Con tu DNI y celular recepción te identifica al llegar y te avisa si algo cambia en tu reserva.')}>
      <div>
        <h1>{t('¿Quieres completar tus datos ahora?')}</h1>
        <p className="muted">{t('Puedes dejar tu nombre completo, DNI y celular ahora o hacerlo después en Mi perfil. Te los pediremos al reservar si aún faltan.')}</p>
      </div>
      <FormError error={save.error} />
      <form onSubmit={submit} className="stack" style={{ gap: 14 }} noValidate>
        <Field label={t('Correo de Google')} type="email" value={user?.email ?? ''} readOnly />
        <ProfileFields form={form} onChange={setForm} error={save.error} />
        <button className="btn btn-primary" type="submit" disabled={save.isPending}>
          {save.isPending ? t('Guardando…') : t('Guardar y continuar')}
        </button>
        <button className="btn" type="button" onClick={later}>{t('Más tarde')}</button>
      </form>
    </AuthLayout>
  )
}
