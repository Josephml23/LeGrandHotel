import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError, getOne, send } from '../../lib/api'
import { useAction } from '../../lib/hooks'
import { useAuth } from '../../auth/AuthContext'
import { FormError, TitleRow } from '../../components/ui'
import type { Client } from '../../types'
import { ClientFields, clientFormFrom } from '../ClientsPage'

export function ProfilePage() {
  const { user } = useAuth()
  const profile = useQuery({
    queryKey: ['me', 'client'],
    queryFn: () => getOne<Client>('/me/client'),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  })
  return (
    <>
      <TitleRow title="Mi perfil" lede={`Tus datos de huésped. Tu cuenta: ${user?.email}`} />
      {profile.error instanceof ApiError && profile.error.status === 404 && (
        <div className="banner">Completa tu ficha de huésped para poder reservar.</div>
      )}
      {!profile.isLoading && <ProfileForm key={profile.data?.id ?? 'new'} initial={profile.data ?? ({ full_name: user?.name } as Client)} />}
    </>
  )
}

function ProfileForm({ initial }: { initial: Client }) {
  const [form, setForm] = useState(() => clientFormFrom(initial))
  const save = useAction(() => send('put', '/me/client', form), { invalidate: ['me'], success: 'Perfil actualizado.' })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form className="form-grid" style={{ maxWidth: 640 }} onSubmit={submit}>
      <div className="full"><FormError error={save.error} /></div>
      <ClientFields form={form} setForm={setForm} error={save.error} />
      <div className="full">
        <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}
