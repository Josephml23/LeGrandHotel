import { Link } from 'react-router-dom'
import { send } from '../../lib/api'
import { useAction, useServerList } from '../../lib/hooks'
import { RESERVATION_STATUS, formatDate, formatMoney, nights, todayISO } from '../../lib/format'
import { DataTable, FormError, Pagination, Pill, TitleRow, type Column } from '../../components/ui'
import type { Reservation } from '../../types'
import { t } from '../../lib/i18n'

/** Reservas del propio cliente. Puede cancelar las confirmadas antes del día de llegada. */
export function MyReservationsPage() {
  const list = useServerList<Reservation>('portal/reservations')
  const cancel = useAction((id: number) => send('post', `/portal/reservations/${id}/cancel`), {
    invalidate: ['portal/reservations', 'portal-room-types'],
    success: t('Reserva cancelada.'),
  })

  const columns: Column<Reservation>[] = [
    {
      key: 'room', header: t('Habitación'), render: (r) => (
        <span className="identity"><strong>{r.room?.room_type?.name ?? '—'}</strong><span>{t('Hab. {number}', { number: r.room?.number ?? '—' })}</span></span>
      ),
    },
    { key: 'dates', header: t('Fechas'), render: (r) => <span className="num">{formatDate(r.check_in)} → {formatDate(r.check_out)}</span> },
    { key: 'nights', header: t('Noches'), align: 'right', className: 'hide-sm', render: (r) => <span className="num">{nights(r.check_in, r.check_out)}</span> },
    { key: 'total', header: t('Total'), align: 'right', render: (r) => <span className="num">{formatMoney(r.total)}</span> },
    { key: 'status', header: t('Estado'), render: (r) => <Pill tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Pill> },
  ]
  const cancellable = (r: Reservation) => ['pending', 'confirmed'].includes(r.status) && r.check_in > todayISO()

  return (
    <>
      <TitleRow title={t('Mis reservas')} lede={t('Recepción ve tus reservas y hace el check-in cuando llegas. El pago se hace en el hotel.')}>
        <Link className="btn btn-primary" to="/reservar">{t('Nueva reserva')}</Link>
      </TitleRow>
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty={t('Todavía no tienes reservas.')}
        actions={(r) => cancellable(r) ? (
          <button className="btn btn-sm btn-ghost btn-danger" disabled={cancel.isPending}
            onClick={() => confirm(t('¿Cancelar tu reserva del {date}?', { date: formatDate(r.check_in) })) && cancel.mutate(r.id)}>{t('Cancelar')}</button>
        ) : null} />
      <Pagination meta={list.meta} onPage={list.setPage} noun={t('reservas')} />
      <FormError error={cancel.error} />
    </>
  )
}
