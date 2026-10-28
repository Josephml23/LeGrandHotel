import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getList, send } from '../lib/api'
import { remove, useAction, useServerList } from '../lib/hooks'
import { ROOM_STATUS } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { DataTable, Field, FormError, Modal, Pagination, Pill, SearchInput, SelectField, TitleRow, fieldError, type Column } from '../components/ui'
import type { Room, RoomStatus, RoomType } from '../types'
import { t } from '../lib/i18n'

const STATUS_TABS: { value: '' | RoomStatus; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'available', label: 'Libres' },
  { value: 'occupied', label: 'Ocupadas' },
  { value: 'cleaning', label: 'En limpieza' },
  { value: 'maintenance', label: 'Mantenimiento' },
]

export function RoomsPage() {
  const { hasRole } = useAuth()
  const [status, setStatus] = useState<'' | RoomStatus>('')
  const list = useServerList<Room>('rooms', { status })
  // Desde el tablero del panel llega la habitación en el estado de la navegación.
  const location = useLocation()
  const [editing, setEditing] = useState<Room | 'new' | null>(() => (location.state as { edit?: Room } | null)?.edit ?? null)

  const types = useQuery({ queryKey: ['room-types', 'all'], queryFn: () => getList<RoomType>('/room-types', { per_page: 50 }) })

  const changeStatus = useAction(({ id, status }: { id: number; status: RoomStatus }) => send('patch', `/rooms/${id}/status`, { status }), {
    invalidate: ['rooms'],
    success: t('Estado actualizado.'),
  })
  const destroy = useAction(remove('rooms'), { invalidate: ['rooms', 'room-types'], success: t('Habitación eliminada.') })

  const columns: Column<Room>[] = [
    { key: 'number', header: t('Habitación'), render: (r) => <span className="identity"><strong className="num">{r.number}</strong><span>{t('Piso {floor}', { floor: r.floor })}</span></span> },
    { key: 'type', header: t('Tipo'), render: (r) => r.room_type?.name ?? '—' },
    { key: 'capacity', header: t('Capacidad'), align: 'right', className: 'hide-sm', render: (r) => <span className="num">{t('{n} pers.', { n: r.room_type?.capacity ?? '—' })}</span> },
    { key: 'price', header: t('Precio por noche'), align: 'right', className: 'hide-sm', render: (r) => <span className="num">S/ {r.room_type?.price_per_night ?? '—'}</span> },
    { key: 'status', header: t('Estado'), render: (r) => <Pill tone={ROOM_STATUS[r.status].tone}>{ROOM_STATUS[r.status].label}</Pill> },
  ]

  return (
    <>
      <TitleRow title={t('Habitaciones')} lede={t('Estado de cada habitación. Al hacer check-out pasa a limpieza; márcala libre cuando esté lista.')}>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>{t('Nueva habitación')}</button>
      </TitleRow>

      <div className="tabs" role="tablist" aria-label={t('Filtrar por estado')}>
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} role="tab" className="tab" aria-selected={status === tab.value} onClick={() => { setStatus(tab.value); list.setPage(1) }}>
            {t(tab.label)}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <SearchInput value={list.search} onChange={list.setSearch} label={t('Buscar por número')} />
        <span className="muted num">{list.meta?.total ?? 0} {t('habitaciones')}</span>
      </div>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.isLoading}
        error={list.error}
        empty={t('No hay habitaciones con este filtro.')}
        actions={(r) => (
          <>
            {r.status === 'cleaning' && (
              <button className="btn btn-sm" onClick={() => changeStatus.mutate({ id: r.id, status: 'available' })}>{t('Marcar lista')}</button>
            )}{' '}
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(r)}>{t('Editar')}</button>
            {hasRole('admin', 'receptionist') && (
              <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(t('¿Eliminar la habitación {number}?', { number: r.number })) && destroy.mutate(r.id)}>{t('Eliminar')}</button>
            )}
          </>
        )}
      />
      <Pagination meta={list.meta} onPage={list.setPage} noun={t('habitaciones')} />
      {destroy.error != null && <FormError error={destroy.error} />}

      {editing !== null && types.data && (
        <RoomForm key={editing === 'new' ? 'new' : editing.id} room={editing} types={types.data.data} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

function RoomForm({ room, types, onClose }: { room: Room | 'new' | null; types: RoomType[]; onClose: () => void }) {
  const isNew = room === 'new'
  const current = room && room !== 'new' ? room : null
  const [form, setForm] = useState(() => ({
    number: current?.number ?? '',
    floor: String(current?.floor ?? 1),
    room_type_id: String(current?.room_type_id ?? types[0]?.id ?? ''),
    status: current?.status ?? ('available' as RoomStatus),
  }))

  const save = useAction(
    () => {
      const body = { ...form, floor: Number(form.floor), room_type_id: Number(form.room_type_id) }
      return isNew ? send('post', '/rooms', body) : send('put', `/rooms/${current!.id}`, body)
    },
    { invalidate: ['rooms', 'room-types'], success: isNew ? t('Habitación creada.') : t('Cambios guardados.') },
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Modal open={room !== null} title={isNew ? t('Nueva habitación') : t('Habitación {number}', { number: current?.number ?? '' })} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>{t('Cancelar')}</button><button className="btn btn-primary" form="room-form" disabled={save.isPending}>{t('Guardar')}</button></>}>
      <FormError error={save.error} />
      <form id="room-form" className="form-grid" onSubmit={submit}>
        <Field label={t('Número')} required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} error={fieldError(save.error, 'number')} />
        <Field label={t('Piso')} type="number" min={0} required value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} error={fieldError(save.error, 'floor')} />
        <SelectField label={t('Tipo')} value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })} error={fieldError(save.error, 'room_type_id')}
          options={types.map((rt) => ({ value: rt.id, label: `${rt.name} · ${t('{n} pers.', { n: rt.capacity })} · S/ ${rt.price_per_night}` }))} />
        <SelectField label={t('Estado')} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RoomStatus })}
          options={Object.entries(ROOM_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
      </form>
    </Modal>
  )
}
