import { useState } from 'react'
import { send } from '../../lib/api'
import { useAction, useServerList } from '../../lib/hooks'
import { formatDate, formatMoney, nights, RESERVATION_STATUS } from '../../lib/format'
import { useAuth } from '../../auth/AuthContext'
import { DataTable, FormError, Pagination, Pill, TitleRow, type Column } from '../../components/ui'
import type { Reservation } from '../../types'
import { NewReservation } from '../ReservationsPage'

/** El cliente solo ve sus reservas: el backend filtra por su ficha y la policy bloquea las ajenas. */
export function MyReservationsPage({ startBooking = false }: { startBooking?: boolean }) {
  const { user } = useAuth()
  const list = useServerList<Reservation>('reservations')
  const [booking, setBooking] = useState(startBooking)
  const cancel = useAction((id: number) => send('put', `/reservations/${id}`, { status: 'cancelled' }), {
    invalidate: ['reservations'],
    success: 'Reserva cancelada.',
  })

  const columns: Column<Reservation>[] = [
    { key: 'room', header: 'Habitación', render: (r) => <span className="identity"><strong>{r.room?.room_type?.name}</strong><span className="num">N.º {r.room?.number}</span></span> },
    { key: 'dates', header: 'Fechas', render: (r) => <span className="num">{formatDate(r.check_in)} → {formatDate(r.check_out)}</span> },
    { key: 'nights', header: 'Noches', align: 'right', className: 'hide-sm', render: (r) => <span className="num">{nights(r.check_in, r.check_out)}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="num">{formatMoney(r.total)}</span> },
    { key: 'status', header: 'Estado', render: (r) => <Pill tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Pill> },
  ]

  return (
    <>
      <TitleRow title="Mis reservas" lede={`Hola, ${user?.name.split(' ')[0]}. Aquí ves y gestionas tus estadías en LeGrandHotel.`}>
        <button className="btn btn-primary" disabled={!user?.email_verified} onClick={() => setBooking(true)}
          title={!user?.email_verified ? 'Verifica tu correo para reservar' : undefined}>Reservar habitación</button>
      </TitleRow>
      <FormError error={cancel.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty="Todavía no tienes reservas. Elige tus fechas con «Reservar habitación»."
        actions={(r) => (r.status === 'confirmed' || r.status === 'pending') && (
          <button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Cancelar esta reserva?') && cancel.mutate(r.id)}>Cancelar</button>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun="reservas" />
      <NewReservation open={booking} onClose={() => setBooking(false)} staff={false} />
    </>
  )
}
