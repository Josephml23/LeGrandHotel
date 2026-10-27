import { useState, type FormEvent } from 'react'
import { send } from '../lib/api'
import { remove, useAction, useServerList } from '../lib/hooks'
import { formatMoney } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { DataTable, Field, FormError, Modal, Pagination, SearchInput, TitleRow, fieldError, type Column } from '../components/ui'
import type { RoomType } from '../types'

export function RoomTypesPage() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin')
  const list = useServerList<RoomType>('room-types')
  const [editing, setEditing] = useState<RoomType | 'new' | null>(null)
  const destroy = useAction(remove('room-types'), { invalidate: ['room-types'], success: 'Tipo eliminado.' })

  const columns: Column<RoomType>[] = [
    { key: 'name', header: 'Tipo', render: (t) => <span className="identity"><strong>{t.name}</strong><span>{t.description ?? '—'}</span></span> },
    { key: 'amenities', header: 'Incluye', className: 'hide-sm', render: (t) => <span className="muted small">{t.amenities?.join(' · ') || '—'}</span> },
    { key: 'capacity', header: 'Capacidad', align: 'right', render: (t) => <span className="num">{t.capacity} pers.</span> },
    { key: 'price', header: 'Precio por noche', align: 'right', render: (t) => <span className="num">{formatMoney(t.price_per_night)}</span> },
    { key: 'rooms', header: 'Habitaciones', align: 'right', render: (t) => <span className="num">{t.rooms_count ?? 0}</span> },
  ]

  return (
    <>
      <TitleRow title="Tipos de habitación" lede={canEdit ? 'La tarifa por noche se usa para calcular el total de cada reserva.' : 'Solo lectura: los precios los define el administrador.'}>
        {canEdit && <button className="btn btn-primary" onClick={() => setEditing('new')}>Nuevo tipo</button>}
      </TitleRow>
      <div className="toolbar">
        <SearchInput value={list.search} onChange={list.setSearch} label="Buscar tipo" />
        <span className="muted num">{list.meta?.total ?? 0} tipos</span>
      </div>
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty="Todavía no hay tipos de habitación."
        actions={canEdit ? (t) => (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(t)}>Editar</button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(`¿Eliminar el tipo ${t.name}?`) && destroy.mutate(t.id)}>Eliminar</button>
          </>
        ) : undefined} />
      <Pagination meta={list.meta} onPage={list.setPage} noun="tipos" />
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
    { invalidate: ['room-types', 'rooms'], success: 'Tipo guardado.' },
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Modal open={value !== null} title={current ? `Editar ${current.name}` : 'Nuevo tipo de habitación'} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" form="type-form" disabled={save.isPending}>Guardar</button></>}>
      <FormError error={save.error} />
      <form id="type-form" className="form-grid" onSubmit={submit}>
        <Field className="full" label="Nombre" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError(save.error, 'name')} />
        <Field label="Capacidad (personas)" type="number" min={1} max={20} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} error={fieldError(save.error, 'capacity')} />
        <Field label="Precio por noche (S/)" type="number" min={0} step="0.01" required value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} error={fieldError(save.error, 'price_per_night')} />
        <Field className="full" label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Field className="full" label="Incluye (servicios)" value={form.amenities} placeholder="Wi-Fi, TV, Baño privado"
          hint="Separados por comas. El cliente los ve al reservar." onChange={(e) => setForm({ ...form, amenities: e.target.value })}
          error={fieldError(save.error, 'amenities')} />
      </form>
    </Modal>
  )
}
