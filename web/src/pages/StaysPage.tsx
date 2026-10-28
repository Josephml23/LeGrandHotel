import { useState } from 'react'
import { send } from '../lib/api'
import { useAction, useServerList } from '../lib/hooks'
import { formatDate, formatDateTime } from '../lib/format'
import { DataTable, FormError, Pagination, Pill, TitleRow, type Column } from '../components/ui'
import type { Stay } from '../types'
import { t } from '../lib/i18n'

export function StaysPage() {
  const [active, setActive] = useState(true)
  const list = useServerList<Stay>('stays', { active: active ? 1 : undefined })
  const checkOut = useAction((id: number) => send('post', `/stays/${id}/check-out`), {
    invalidate: ['stays', 'reservations', 'rooms', 'parking-assignments', 'parking-spots'],
    success: t('Check-out registrado. La habitación pasó a limpieza.'),
  })

  const columns: Column<Stay>[] = [
    { key: 'guest', header: t('Huésped'), render: (s) => <span className="identity"><strong>{s.reservation?.client?.full_name}</strong><span>{t('Reserva #{id}', { id: s.reservation_id })}</span></span> },
    { key: 'room', header: t('Habitación'), render: (s) => <span className="num">{s.reservation?.room?.number}</span> },
    { key: 'in', header: t('Entrada'), render: (s) => <span className="num">{formatDateTime(s.checked_in_at)}</span> },
    { key: 'planned', header: t('Salida prevista'), className: 'hide-sm', render: (s) => <span className="num">{formatDate(s.reservation?.check_out)}</span> },
    { key: 'out', header: t('Salida real'), render: (s) => (s.checked_out_at ? <span className="num">{formatDateTime(s.checked_out_at)}</span> : <Pill tone="accent">{t('Hospedado')}</Pill>) },
  ]

  return (
    <>
      <TitleRow title={t('Estadías')} lede={t('Huéspedes dentro del hotel. El check-out libera la habitación y su espacio de cochera.')} />
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={active} onClick={() => { setActive(true); list.setPage(1) }}>{t('En curso')}</button>
        <button role="tab" className="tab" aria-selected={!active} onClick={() => { setActive(false); list.setPage(1) }}>{t('Historial')}</button>
      </div>
      <FormError error={checkOut.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error}
        empty={active ? t('No hay huéspedes hospedados ahora.') : t('Todavía no hay estadías registradas.')}
        actions={(s) => !s.checked_out_at && (
          <button className="btn btn-sm" onClick={() => confirm(t('¿Registrar el check-out?')) && checkOut.mutate(s.id)} disabled={checkOut.isPending}>{t('Check-out')}</button>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun={t('estadías')} />
    </>
  )
}
