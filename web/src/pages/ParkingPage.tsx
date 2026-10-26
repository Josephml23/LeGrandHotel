import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getList, send } from '../lib/api'
import { remove, useAction, useServerList } from '../lib/hooks'
import { formatDateTime } from '../lib/format'
import { DataTable, Field, FormError, Modal, Pagination, Pill, SearchInput, SelectField, TitleRow, fieldError, type Column } from '../components/ui'
import type { ParkingAssignment, ParkingSpot, Stay } from '../types'

const SPOT_STATUS = {
  free: { label: 'Libre', tone: 'positive' },
  occupied: { label: 'Ocupado', tone: 'accent' },
  maintenance: { label: 'Mantenimiento', tone: 'neutral' },
} as const

export function ParkingPage() {
  const [tab, setTab] = useState<'assignments' | 'spots'>('assignments')
  return (
    <>
      <TitleRow title="Cochera" lede="Registra la placa al entrar y la salida al irse; el espacio se libera solo." />
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={tab === 'assignments'} onClick={() => setTab('assignments')}>Vehículos</button>
        <button role="tab" className="tab" aria-selected={tab === 'spots'} onClick={() => setTab('spots')}>Espacios</button>
      </div>
      {tab === 'assignments' ? <Assignments /> : <Spots />}
    </>
  )
}

function Assignments() {
  const [active, setActive] = useState(true)
  const list = useServerList<ParkingAssignment>('parking-assignments', { active: active ? 1 : undefined })
  const [creating, setCreating] = useState(false)
  const leave = useAction((id: number) => send('put', `/parking-assignments/${id}`, { left_at: new Date().toISOString() }), {
    invalidate: ['parking-assignments', 'parking-spots'],
    success: 'Salida registrada. El espacio quedó libre.',
  })

  const columns: Column<ParkingAssignment>[] = [
    { key: 'plate', header: 'Placa', render: (a) => <strong className="num">{a.plate}</strong> },
    { key: 'spot', header: 'Espacio', render: (a) => <span className="num">{a.parking_spot?.code}</span> },
    { key: 'guest', header: 'Huésped', className: 'hide-sm', render: (a) => a.stay?.reservation?.client?.full_name ?? <span className="muted">Visita</span> },
    { key: 'in', header: 'Entrada', render: (a) => <span className="num">{formatDateTime(a.entered_at)}</span> },
    { key: 'out', header: 'Salida', render: (a) => (a.left_at ? <span className="num">{formatDateTime(a.left_at)}</span> : <Pill tone="accent">Dentro</Pill>) },
  ]

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <SearchInput value={list.search} onChange={list.setSearch} label="Buscar placa" />
          <label className="small"><input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); list.setPage(1) }} /> Solo dentro</label>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>Registrar entrada</button>
      </div>
      <FormError error={leave.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty="No hay vehículos con este filtro."
        actions={(a) => !a.left_at && <button className="btn btn-sm" onClick={() => leave.mutate(a.id)}>Registrar salida</button>} />
      <Pagination meta={list.meta} onPage={list.setPage} noun="registros" />
      <EntryForm open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function EntryForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ parking_spot_id: '', stay_id: '', plate: '' })
  const spots = useQuery({ queryKey: ['parking-spots', 'free'], queryFn: () => getList<ParkingSpot>('/parking-spots', { status: 'free', per_page: 50 }), enabled: open })
  const stays = useQuery({ queryKey: ['stays', 'active-picker'], queryFn: () => getList<Stay>('/stays', { active: 1, per_page: 50 }), enabled: open })

  const save = useAction(() => send('post', '/parking-assignments', {
    parking_spot_id: Number(form.parking_spot_id),
    stay_id: form.stay_id ? Number(form.stay_id) : null,
    plate: form.plate,
  }), { invalidate: ['parking-assignments', 'parking-spots'], success: 'Entrada registrada.' })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: () => { setForm({ parking_spot_id: '', stay_id: '', plate: '' }); onClose() } })
  }

  return (
    <Modal open={open} title="Registrar entrada a cochera" onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" form="entry-form" disabled={save.isPending}>Registrar</button></>}>
      <FormError error={save.error} />
      <form id="entry-form" className="form-grid" onSubmit={submit}>
        <Field label="Placa" required value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} error={fieldError(save.error, 'plate')} hint="Letras, números y guion." />
        <SelectField label="Espacio libre" required value={form.parking_spot_id} onChange={(e) => setForm({ ...form, parking_spot_id: e.target.value })} error={fieldError(save.error, 'parking_spot_id')}
          options={[{ value: '', label: `${spots.data?.meta.total ?? 0} libres` }, ...(spots.data?.data ?? []).map((s) => ({ value: s.id, label: s.code }))]} />
        <SelectField className="full" label="Estadía (opcional)" value={form.stay_id} onChange={(e) => setForm({ ...form, stay_id: e.target.value })}
          options={[{ value: '', label: 'Sin estadía: visita' }, ...(stays.data?.data ?? []).map((s) => ({ value: s.id, label: `Hab. ${s.reservation?.room?.number} · ${s.reservation?.client?.full_name}` }))]} />
      </form>
    </Modal>
  )
}

function Spots() {
  const list = useServerList<ParkingSpot>('parking-spots', {}, 30)
  const [code, setCode] = useState('')
  const create = useAction(() => send('post', '/parking-spots', { code }), { invalidate: ['parking-spots'], success: 'Espacio creado.' })
  const toggle = useAction((s: ParkingSpot) => send('put', `/parking-spots/${s.id}`, { status: s.status === 'maintenance' ? 'free' : 'maintenance' }), {
    invalidate: ['parking-spots'],
  })
  const destroy = useAction(remove('parking-spots'), { invalidate: ['parking-spots'], success: 'Espacio eliminado.' })

  const columns: Column<ParkingSpot>[] = [
    { key: 'code', header: 'Espacio', render: (s) => <strong className="num">{s.code}</strong> },
    { key: 'status', header: 'Estado', render: (s) => <Pill tone={SPOT_STATUS[s.status].tone}>{SPOT_STATUS[s.status].label}</Pill> },
  ]

  return (
    <>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined, { onSuccess: () => setCode('') }) }}>
        <div className="filters">
          <input className="input" style={{ width: 160 }} aria-label="Código del nuevo espacio" placeholder="Ej.: E-11" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary" disabled={!code || create.isPending}>Agregar espacio</button>
        </div>
        <span className="muted num">{list.meta?.total ?? 0} espacios</span>
      </form>
      <FormError error={create.error ?? destroy.error ?? toggle.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty="No hay espacios de cochera."
        actions={(s) => (
          <>
            {s.status !== 'occupied' && (
              <button className="btn btn-sm btn-ghost" onClick={() => toggle.mutate(s)}>{s.status === 'maintenance' ? 'Habilitar' : 'Mantenimiento'}</button>
            )}
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(`¿Eliminar el espacio ${s.code}?`) && destroy.mutate(s.id)}>Eliminar</button>
          </>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun="espacios" />
    </>
  )
}
