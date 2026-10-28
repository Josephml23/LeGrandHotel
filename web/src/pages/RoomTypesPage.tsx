import { useState, type FormEvent } from 'react'
import { send } from '../lib/api'
import { remove, useAction, useServerList } from '../lib/hooks'
import { formatMoney } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { DataTable, Field, FormError, Modal, Pagination, SearchInput, TitleRow, fieldError, type Column } from '../components/ui'
import type { RoomType } from '../types'
import { t } from '../lib/i18n'

export function RoomTypesPage() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin')
  const list = useServerList<RoomType>('room-types')
  const [editing, setEditing] = useState<RoomType | 'new' | null>(null)
  const destroy = useAction(remove('room-types'), { invalidate: ['room-types'], success: t('Tipo eliminado.') })

  const columns: Column<RoomType>[] = [
    { key: 'name', header: t('Tipo'), render: (rt) => <span className="identity"><strong>{rt.name}</strong><span>{rt.description ?? '—'}</span></span> },
    { key: 'amenities', header: t('Incluye'), className: 'hide-sm', render: (rt) => <span className="muted small">{rt.amenities?.join(' · ') || '—'}</span> },
    { key: 'capacity', header: t('Capacidad'), align: 'right', render: (rt) => <span className="num">{t('{n} pers.', { n: rt.capacity })}</span> },
    { key: 'price', header: t('Precio por noche'), align: 'right', render: (rt) => <span className="num">{formatMoney(rt.price_per_night)}</span> },
    { key: 'rooms', header: t('Habitaciones'), align: 'right', render: (rt) => <span className="num">{rt.rooms_count ?? 0}</span> },
  ]

  return (
    <>
      <TitleRow title={t('Tipos de habitación')} lede={canEdit ? t('La tarifa por noche se usa para calcular el total de cada reserva.') : t('Solo lectura: los precios los define el administrador.')}>
        {canEdit && <button className="btn btn-primary" onClick={() => setEditing('new')}>{t('Nuevo tipo')}</button>}
      </TitleRow>
      <div className="toolbar">
        <SearchInput value={list.search} onChange={list.setSearch} label={t('Buscar tipo')} />
        <span className="muted num">{list.meta?.total ?? 0} {t('tipos')}</span>
      </div>
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty={t('Todavía no hay tipos de habitación.')}
        actions={canEdit ? (rt) => (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(rt)}>{t('Editar')}</button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(t('¿Eliminar el tipo {name}?', { name: rt.name })) && destroy.mutate(rt.id)}>{t('Eliminar')}</button>
          </>
        ) : undefined} />
      <Pagination meta={list.meta} onPage={list.setPage} noun={t('tipos')} />
      <FormError error={destroy.error} />
      {canEdit && editing !== null && <RoomTypeForm key={editing === 'new' ? 'new' : editing.id} value={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function RoomTypeForm({ value, onClose }: { value: RoomType | 'new' | null; onClose: () => void }) {
  const current = value && value !== 'new' ? value : null
  const [form, setForm] = useState(() => ({
    name: current?.name ?? '',
    description: current?.description ?? '',
    capacity: String(current?.capacity ?? 2),
    price_per_night: current?.price_per_night ?? '',
    amenities: current?.amenities?.join(', ') ?? '',
  }))

  const save = useAction(
    () => {
      // Servicios separados por comas → lista, que el cliente ve como etiquetas al reservar.
      const amenities = form.amenities.split(',').map((a) => a.trim()).filter(Boolean)
      const body = { ...form, amenities, capacity: Number(form.capacity), price_per_night: Number(form.price_per_night) }
      return current ? send('put', `/room-types/${current.id}`, body) : send('post', '/room-types', body)
    },
    { invalidate: ['room-types', 'rooms'], success: t('Tipo guardado.') },
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Modal open={value !== null} title={current ? t('Editar {name}', { name: current.name }) : t('Nuevo tipo de habitación')} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>{t('Cancelar')}</button><button className="btn btn-primary" form="type-form" disabled={save.isPending}>{t('Guardar')}</button></>}>
      <FormError error={save.error} />
      <form id="type-form" className="form-grid" onSubmit={submit}>
        <Field className="full" label={t('Nombre')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError(save.error, 'name')} />
        <Field label={t('Capacidad (personas)')} type="number" min={1} max={20} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} error={fieldError(save.error, 'capacity')} />
        <Field label={t('Precio por noche (S/)')} type="number" min={0} step="0.01" required value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} error={fieldError(save.error, 'price_per_night')} />
        <Field className="full" label={t('Descripción')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Field className="full" label={t('Incluye (servicios)')} value={form.amenities} placeholder={t('Wi-Fi, TV, Baño privado')}
          hint={t('Separados por comas. El cliente los ve al reservar.')} onChange={(e) => setForm({ ...form, amenities: e.target.value })}
          error={fieldError(save.error, 'amenities')} />
      </form>
    </Modal>
  )
}
