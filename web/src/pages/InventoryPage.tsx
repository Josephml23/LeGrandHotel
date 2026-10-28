import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getList, send } from '../lib/api'
import { remove, useAction, useServerList } from '../lib/hooks'
import { formatDateTime } from '../lib/format'
import { DataTable, Field, FormError, Modal, Pagination, Pill, SearchInput, SelectField, TitleRow, fieldError, type Column } from '../components/ui'
import type { InventoryItem, InventoryMovement } from '../types'
import { t } from '../lib/i18n'

export function InventoryPage() {
  const [lowOnly, setLowOnly] = useState(false)
  const list = useServerList<InventoryItem>('inventory-items', { low_stock: lowOnly ? 1 : undefined })
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null)
  const [moving, setMoving] = useState<InventoryItem | null>(null)
  const destroy = useAction(remove('inventory-items'), { invalidate: ['inventory-items'], success: t('Insumo eliminado.') })

  const columns: Column<InventoryItem>[] = [
    { key: 'name', header: t('Insumo'), render: (i) => <span className="identity"><strong>{i.name}</strong><span>{i.unit}</span></span> },
    { key: 'stock', header: t('Stock'), align: 'right', render: (i) => <span className="num">{i.stock}</span> },
    { key: 'min', header: t('Mínimo'), align: 'right', render: (i) => <span className="num muted">{i.min_stock}</span> },
    {
      key: 'level', header: t('Nivel'), className: 'hide-sm', render: (i) => (
        <div className="meter" style={{ width: 120 }} aria-label={t('{n} de {total}', { n: i.stock, total: i.min_stock * 3 })}>
          <span style={{ width: `${Math.min(100, (i.stock / Math.max(i.min_stock * 3, 1)) * 100)}%`, background: i.low_stock ? 'var(--negative)' : undefined }} />
        </div>
      ),
    },
    { key: 'state', header: t('Estado'), render: (i) => (i.stock === 0 ? <Pill tone="negative">{t('Agotado')}</Pill> : i.low_stock ? <Pill tone="warning">{t('Reponer')}</Pill> : <Pill tone="positive">{t('Suficiente')}</Pill>) },
  ]

  return (
    <>
      <TitleRow title={t('Inventario')} lede={t('Toallas, amenities y lencería. Cada entrada o salida queda registrada con quién la hizo.')}>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>{t('Nuevo insumo')}</button>
      </TitleRow>
      <div className="toolbar">
        <div className="filters">
          <SearchInput value={list.search} onChange={list.setSearch} label={t('Buscar insumo')} />
          <label className="small"><input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); list.setPage(1) }} /> {t('Solo bajo el mínimo')}</label>
        </div>
        <span className="muted num">{list.meta?.total ?? 0} {t('insumos')}</span>
      </div>
      <FormError error={destroy.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty={t('No hay insumos con este filtro.')}
        actions={(i) => (
          <>
            <button className="btn btn-sm" onClick={() => setMoving(i)}>{t('Movimiento')}</button>{' '}
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(i)}>{t('Editar')}</button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(t('¿Eliminar {name}?', { name: i.name })) && destroy.mutate(i.id)}>{t('Eliminar')}</button>
          </>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun={t('insumos')} />
      {editing !== null && <ItemForm key={editing === 'new' ? 'new' : editing.id} value={editing} onClose={() => setEditing(null)} />}
      <MovementForm item={moving} onClose={() => setMoving(null)} />
    </>
  )
}

function ItemForm({ value, onClose }: { value: InventoryItem | 'new' | null; onClose: () => void }) {
  const current = value && value !== 'new' ? value : null
  const [form, setForm] = useState(() => ({
    name: current?.name ?? '',
    unit: current?.unit ?? 'unidad',
    stock: String(current?.stock ?? 0),
    min_stock: String(current?.min_stock ?? 10),
  }))

  const save = useAction(() => {
    const body = { name: form.name, unit: form.unit, min_stock: Number(form.min_stock) }
    return current ? send('put', `/inventory-items/${current.id}`, body) : send('post', '/inventory-items', { ...body, stock: Number(form.stock) })
  }, { invalidate: ['inventory-items'], success: t('Insumo guardado.') })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Modal open={value !== null} title={current ? current.name : t('Nuevo insumo')} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>{t('Cancelar')}</button><button className="btn btn-primary" form="item-form" disabled={save.isPending}>{t('Guardar')}</button></>}>
      <FormError error={save.error} />
      <form id="item-form" className="form-grid" onSubmit={submit}>
        <Field className="full" label={t('Nombre')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError(save.error, 'name')} />
        <Field label={t('Unidad')} required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} error={fieldError(save.error, 'unit')} />
        <Field label={t('Stock mínimo')} type="number" min={0} required value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} error={fieldError(save.error, 'min_stock')} />
        {!current && <Field label={t('Stock inicial')} type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} error={fieldError(save.error, 'stock')} hint={t('Después cambia solo con movimientos.')} />}
      </form>
    </Modal>
  )
}

function MovementForm({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const [form, setForm] = useState({ type: 'out', quantity: '1', reason: '' })
  const history = useQuery({
    queryKey: ['inventory-items', item?.id, 'movements'],
    queryFn: () => getList<InventoryMovement>(`/inventory-items/${item!.id}/movements`, { per_page: 5 }),
    enabled: !!item,
  })
  const save = useAction(() => send('post', `/inventory-items/${item!.id}/movements`, { ...form, quantity: Number(form.quantity) }), {
    invalidate: ['inventory-items'],
    success: t('Movimiento registrado.'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: () => { setForm({ type: 'out', quantity: '1', reason: '' }); onClose() } })
  }

  return (
    <Modal open={item !== null} title={item ? t('{name}: {stock} {unit} en stock', { name: item.name, stock: item.stock, unit: item.unit }) : ''} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>{t('Cancelar')}</button><button className="btn btn-primary" form="move-form" disabled={save.isPending}>{t('Registrar')}</button></>}>
      <FormError error={save.error} />
      <form id="move-form" className="form-grid" onSubmit={submit}>
        <SelectField label={t('Tipo')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
          options={[{ value: 'out', label: t('Salida (uso en habitaciones)') }, { value: 'in', label: t('Entrada (compra o devolución)') }]} />
        <Field label={t('Cantidad')} type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} error={fieldError(save.error, 'quantity')} />
        <Field className="full" label={t('Motivo')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </form>
      <div>
        <h3 className="section-title">{t('Últimos movimientos')}</h3>
        {history.data?.data.length ? (
          <ul className="list-rows">
            {history.data.data.map((m) => (
              <li key={m.id}>
                <span className="identity"><strong className="num">{m.type === 'in' ? '+' : '−'}{m.quantity}</strong><span>{m.reason ?? t('Sin motivo')} · {m.user?.name ?? '—'}</span></span>
                <span className="muted small num">{formatDateTime(m.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">{history.isLoading ? t('Cargando…') : t('Sin movimientos todavía.')}</p>}
      </div>
    </Modal>
  )
}
