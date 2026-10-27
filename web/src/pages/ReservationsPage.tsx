import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError, getList, send } from '../lib/api'
import { remove, useAction, useServerList } from '../lib/hooks'
import { addDaysISO, formatDate, formatMoney, nights, RESERVATION_STATUS, todayISO } from '../lib/format'
import { DataTable, Field, FormError, Modal, Pagination, Pill, SearchInput, SelectField, TitleRow, fieldError, useDebounced, type Column } from '../components/ui'
import type { Client, Reservation, ReservationStatus, Room } from '../types'

const TABS: { value: '' | ReservationStatus; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'pending', label: 'Por confirmar' },
  { value: 'checked_in', label: 'Hospedados' },
  { value: 'completed', label: 'Finalizadas' },
  { value: 'cancelled', label: 'Canceladas' },
]

export function ReservationsPage() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<'' | ReservationStatus>('')
  const list = useServerList<Reservation>('reservations', { status })
  const [creating, setCreating] = useState(params.get('nueva') === '1')
  const checkinId = Number(params.get('checkin')) || null

  const checkIn = useAction((id: number) => send('post', `/reservations/${id}/check-in`), {
    invalidate: ['reservations', 'rooms', 'stays'],
    success: 'Check-in registrado. La habitación quedó ocupada.',
  })
  const cancel = useAction((id: number) => send('put', `/reservations/${id}`, { status: 'cancelled' }), {
    invalidate: ['reservations'],
    success: 'Reserva cancelada.',
  })
  const destroy = useAction(remove('reservations'), { invalidate: ['reservations'], success: 'Reserva eliminada.' })

  // Desde el panel: /reservas?checkin=ID
  useEffect(() => {
    if (checkinId && confirm('¿Registrar el check-in de esta reserva ahora?')) checkIn.mutate(checkinId)
    if (checkinId) setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkinId])

  const columns: Column<Reservation>[] = [
    { key: 'client', header: 'Huésped', render: (r) => <span className="identity"><strong>{r.client?.full_name}</strong><span className="num">{r.client?.document_number}</span></span> },
    { key: 'room', header: 'Habitación', render: (r) => <span className="identity"><strong className="num">{r.room?.number}</strong><span>{r.room?.room_type?.name}</span></span> },
    { key: 'dates', header: 'Fechas', render: (r) => <span className="num">{formatDate(r.check_in)} → {formatDate(r.check_out)}</span> },
    { key: 'nights', header: 'Noches', align: 'right', className: 'hide-sm', render: (r) => <span className="num">{nights(r.check_in, r.check_out)}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="num">{formatMoney(r.total)}</span> },
    { key: 'status', header: 'Estado', render: (r) => <Pill tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Pill> },
  ]

  const actionError = checkIn.error ?? cancel.error ?? destroy.error

  return (
    <>
      <TitleRow title="Reservas" lede="Busca por huésped o documento. El check-in crea la estadía y ocupa la habitación.">
        <button className="btn btn-primary" onClick={() => setCreating(true)}>Nueva reserva</button>
      </TitleRow>
      <div className="tabs" role="tablist" aria-label="Filtrar por estado">
        {TABS.map((t) => (
          <button key={t.value} role="tab" className="tab" aria-selected={status === t.value} onClick={() => { setStatus(t.value); list.setPage(1) }}>{t.label}</button>
        ))}
      </div>
      <div className="toolbar">
        <SearchInput value={list.search} onChange={list.setSearch} label="Buscar huésped o documento" />
        <span className="muted num">{(list.meta?.total ?? 0).toLocaleString('es-PE')} reservas</span>
      </div>
      {actionError != null && <FormError error={actionError} />}
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty="No hay reservas con este filtro."
        actions={(r) => (
          <>
            {(r.status === 'confirmed' || r.status === 'pending') && (
              <>
                <button className="btn btn-sm" onClick={() => checkIn.mutate(r.id)} disabled={checkIn.isPending}>Check-in</button>{' '}
                <button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Cancelar esta reserva?') && cancel.mutate(r.id)}>Cancelar</button>
              </>
            )}
            {(r.status === 'cancelled') && (
              <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm('¿Eliminar la reserva cancelada?') && destroy.mutate(r.id)}>Eliminar</button>
            )}
          </>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun="reservas" />
      <NewReservation open={creating} onClose={() => { setCreating(false); if (params.get('nueva')) setParams({}, { replace: true }) }} />
    </>
  )
}

/** Formulario de reserva de recepción: elige el huésped (ficha de cliente) y una habitación libre. */
export function NewReservation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ client_id: '', check_in: todayISO(), check_out: addDaysISO(todayISO(), 1), guests: '1', room_id: '', notes: '' })
  const [clientSearch, setClientSearch] = useState('')
  const debouncedClient = useDebounced(clientSearch)

  const validRange = form.check_out > form.check_in
  const available = useQuery({
    queryKey: ['rooms', 'available', form.check_in, form.check_out, form.guests],
    queryFn: () => getList<Room>('/rooms/available', { from: form.check_in, to: form.check_out, guests: form.guests, per_page: 50 }),
    enabled: open && validRange,
  })
  const clients = useQuery({
    queryKey: ['clients', 'picker', debouncedClient],
    queryFn: () => getList<Client>('/clients', { search: debouncedClient, per_page: 10 }),
    enabled: open,
  })

  const room = available.data?.data.find((r) => String(r.id) === form.room_id)
  const estimate = useMemo(() => (room?.room_type ? Number(room.room_type.price_per_night) * nights(form.check_in, form.check_out) : null), [room, form.check_in, form.check_out])

  const save = useAction(
    () => send<Reservation>('post', '/reservations', {
      client_id: Number(form.client_id),
      room_id: Number(form.room_id),
      check_in: form.check_in,
      check_out: form.check_out,
      guests: Number(form.guests),
      notes: form.notes || null,
    }),
    { invalidate: ['reservations', 'rooms'], success: 'Reserva creada.' },
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, {
      onSuccess: () => {
        setForm((f) => ({ ...f, room_id: '', notes: '' }))
        onClose()
      },
    })
  }

  const conflict = save.error instanceof ApiError && save.error.code === 'ROOM_ALREADY_BOOKED'

  return (
    <Modal open={open} title="Nueva reserva" onClose={() => { save.reset(); onClose() }}
      footer={<>
        <span className="muted num" style={{ marginRight: 'auto' }}>{estimate !== null ? `Total estimado: ${formatMoney(estimate)} · ${nights(form.check_in, form.check_out)} noches` : 'Elige una habitación para ver el total'}</span>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" form="reservation-form" disabled={save.isPending || !form.room_id}>Reservar</button>
      </>}>
      <FormError error={save.error} />
      {conflict && <p className="muted">Otra persona reservó esa habitación en esas fechas. La lista de disponibles ya se actualizó: elige otra.</p>}
      <form id="reservation-form" className="form-grid" onSubmit={submit}>
        <>
            <Field className="full" label="Buscar huésped" type="search" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} hint="Nombre o número de documento." />
            <SelectField className="full" label="Huésped" required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} error={fieldError(save.error, 'client_id')}
              options={[{ value: '', label: clients.isLoading ? 'Cargando…' : 'Selecciona un huésped' }, ...(clients.data?.data ?? []).map((c) => ({ value: c.id, label: `${c.full_name} · ${c.document_type} ${c.document_number}` }))]} />
        </>
        <Field label="Entrada" type="date" min={todayISO()} required value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value, room_id: '' })} error={fieldError(save.error, 'check_in')} />
        <Field label="Salida" type="date" min={addDaysISO(form.check_in, 1)} required value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value, room_id: '' })} error={fieldError(save.error, 'check_out')} />
        <Field label="Huéspedes" type="number" min={1} max={8} value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value, room_id: '' })} error={fieldError(save.error, 'guests')} />
        <SelectField label="Habitación disponible" required value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })} error={fieldError(save.error, 'room_id')}
          options={[
            { value: '', label: !validRange ? 'La salida debe ser después de la entrada' : available.isLoading ? 'Buscando…' : `${available.data?.meta.total ?? 0} disponibles` },
            ...(available.data?.data ?? []).map((r) => ({ value: r.id, label: `${r.number} · ${r.room_type?.name} · S/ ${r.room_type?.price_per_night}/noche` })),
          ]} />
        <Field className="full" label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </form>
    </Modal>
  )
}
