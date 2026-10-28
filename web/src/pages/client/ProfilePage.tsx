import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { send } from '../../lib/api'
import { t } from '../../lib/i18n'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toasts'
import { Field, FormError, Pill, TitleRow } from '../../components/ui'
import type { AuthUser } from '../../types'
import { ProfileFields, profileFrom, profilePayload } from './ProfileFields'

/** Mi perfil: el cliente ve su nombre y su correo de Google, y agrega o cambia su nombre, DNI y celular. */
export function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null
  const complete = !!user.client?.complete

  return (
    <>
      <TitleRow title={t('Mi perfil')} lede={t('Con tu DNI y celular recepción te identifica al llegar. Tus reservas se hacen a este nombre.')}>
        <Pill tone={complete ? 'positive' : 'warning'}>{complete ? t('Listo para reservar') : t('Faltan datos para reservar')}</Pill>
      </TitleRow>
      {/* key: al guardar, el formulario vuelve a montarse con los datos nuevos. */}
      <ProfileForm key={JSON.stringify(user.client ?? null)} user={user} />
    </>
  )
}

function ProfileForm({ user }: { user: AuthUser }) {
  const { updateUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(() => profileFrom(user))

  const save = useMutation({
    mutationFn: () => send<AuthUser>('put', '/portal/profile', profilePayload(form)),
    onSuccess: (updated) => {
      updateUser(updated)
      toast(t('Perfil actualizado.'))
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="form-grid" style={{ maxWidth: 640 }} noValidate>
      <div className="full"><FormError error={save.error} /></div>
      <Field className="full" label={t('Correo de Google')} type="email" value={user.email} readOnly hint={t('Con este correo entras al sistema; no se puede cambiar.')} />
      <div className="full stack" style={{ gap: 14 }}>
        <ProfileFields form={form} onChange={setForm} error={save.error} />
      </div>
      <div className="full">
        <button className="btn btn-primary" type="submit" disabled={save.isPending}>
          {save.isPending ? t('Guardando…') : t('Guardar cambios')}
        </button>
      </div>
    </form>
  )
}
