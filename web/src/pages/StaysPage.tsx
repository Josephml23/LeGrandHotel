import { useState } from 'react'
import { send } from '../lib/api'
import { useAction, useServerList } from '../lib/hooks'
import { formatDate, formatDateTime } from '../lib/format'
import { DataTable, FormError, Pagination, Pill, TitleRow, type Column } from '../components/ui'
import type { Stay } from '../types'

export function StaysPage() {
  const [active, setActive] = useState(true)
  const list = useServerList<Stay>('stays', { active: active ? 1 : undefined })
  const checkOut = useAction((id: number) => send('post', `/stays/${id}/check-out`), {
    invalidate: ['stays', 'reservations', 'rooms', 'parking-assignments', 'parking-spots'],
    success: 'Check-out registrado. La habitación pasó a limpieza.',
  })

  const columns: Column<Stay>[] = [
    { key: 'guest', header: 'Huésped', render: (s) => <span className="identity"><strong>{s.reservation?.client?.full_name}</strong><span>Reserva #{s.reservation_id}</span></span> },
    { key: 'room', header: 'Habitación', render: (s) => <span className="num">{s.reservation?.room?.number}</span> },
    { key: 'in', header: 'Entrada', render: (s) => <span className="num">{formatDateTime(s.checked_in_at)}</span> },
    { key: 'planned', header: 'Salida prevista', className: 'hide-sm', render: (s) => <span className="num">{formatDate(s.reservation?.check_out)}</span> },
    { key: 'out', header: 'Salida real', render: (s) => (s.checked_out_at ? <span className="num">{formatDateTime(s.checked_out_at)}</span> : <Pill tone="accent">Hospedado</Pill>) },
  ]

  return (
    <>
      <TitleRow title="Estadías" lede="Huéspedes dentro del hotel. El check-out libera la habitación y su espacio de cochera." />
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={active} onClick={() => { setActive(true); list.setPage(1) }}>En curso</button>
        <button role="tab" className="tab" aria-selected={!active} onClick={() => { setActive(false); list.setPage(1) }}>Historial</button>
      </div>
      <FormError error={checkOut.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error}
        empty={active ? 'No hay huéspedes hospedados ahora.' : 'Todavía no hay estadías registradas.'}
        actions={(s) => !s.checked_out_at && (
          <button className="btn btn-sm" onClick={() => confirm('¿Registrar el check-out?') && checkOut.mutate(s.id)} disabled={checkOut.isPending}>Check-out</button>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun="estadías" />
    </>
  )
}
