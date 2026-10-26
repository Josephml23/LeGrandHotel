import { useState } from 'react'
import { useServerList } from '../lib/hooks'
import { formatDateTime } from '../lib/format'
import { DataTable, Pagination, Pill, SelectField, TitleRow, type Column } from '../components/ui'
import type { AuditLog } from '../types'

const ACTION = {
  created: { label: 'Creó', tone: 'positive' },
  updated: { label: 'Editó', tone: 'neutral' },
  deleted: { label: 'Eliminó', tone: 'negative' },
} as const

const ENTITIES = ['', 'reservation', 'room', 'room_type', 'client', 'stay', 'parking_assignment', 'parking_spot', 'inventory_item', 'staff', 'user']

export function AuditPage() {
  const [entity, setEntity] = useState('')
  const list = useServerList<AuditLog>('audit-logs', { entity }, 25)

  const columns: Column<AuditLog>[] = [
    { key: 'when', header: 'Cuándo', render: (l) => <span className="num">{formatDateTime(l.created_at)}</span> },
    { key: 'who', header: 'Quién', render: (l) => l.user?.name ?? <span className="muted">Sistema</span> },
    { key: 'action', header: 'Acción', render: (l) => <Pill tone={ACTION[l.action].tone}>{ACTION[l.action].label}</Pill> },
    { key: 'entity', header: 'Registro', render: (l) => <span className="num">{l.entity} #{l.entity_id}</span> },
    {
      key: 'changes', header: 'Cambios', className: 'hide-sm', render: (l) =>
        l.changes ? <span className="muted small">{Object.keys(l.changes).filter((k) => k !== 'created_at').slice(0, 5).join(', ')}</span> : '—',
    },
  ]

  return (
    <>
      <TitleRow title="Auditoría" lede="Quién creó, editó o eliminó cada registro y cuándo." />
      <div className="toolbar">
        <SelectField label="Tipo de registro" value={entity} onChange={(e) => { setEntity(e.target.value); list.setPage(1) }}
          options={ENTITIES.map((e) => ({ value: e, label: e || 'Todos' }))} />
        <span className="muted num">{(list.meta?.total ?? 0).toLocaleString('es-PE')} eventos</span>
      </div>
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty="Sin eventos registrados." />
      <Pagination meta={list.meta} onPage={list.setPage} noun="eventos" />
    </>
  )
}
