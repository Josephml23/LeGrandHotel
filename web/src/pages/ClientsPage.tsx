import { useState, type FormEvent } from 'react'
import { send } from '../lib/api'
import { formatNumber } from '../lib/format'
import { remove, useAction, useServerList } from '../lib/hooks'
import { DataTable, Field, FormError, Modal, Pagination, SearchInput, SelectField, TitleRow, fieldError, soloLetras, soloNumeros, type Column } from '../components/ui'
import type { Client } from '../types'
import { t } from '../lib/i18n'

export function ClientsPage() {
  const list = useServerList<Client>('clients')
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const destroy = useAction(remove('clients'), { invalidate: ['clients'], success: t('Cliente eliminado.') })

  const columns: Column<Client>[] = [
    { key: 'name', header: t('Huésped'), render: (c) => <span className="identity"><strong>{c.full_name}</strong><span>{c.nationality ?? '—'}</span></span> },
    { key: 'doc', header: t('Documento'), render: (c) => <span className="num">{c.document_type} {c.document_number}</span> },
    { key: 'phone', header: t('Teléfono'), className: 'hide-sm', render: (c) => <span className="num">{c.phone ?? '—'}</span> },
    { key: 'account', header: t('Cuenta web'), className: 'hide-sm', render: (c) => (c.user_id ? t('Sí') : <span className="muted">{t('No')}</span>) },
    { key: 'res', header: t('Reservas'), align: 'right', render: (c) => <span className="num">{c.reservations_count ?? 0}</span> },
  ]

  return (
    <>
      <TitleRow title={t('Clientes')} lede={t('Huéspedes registrados en recepción o por la web.')}>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>{t('Nuevo cliente')}</button>
      </TitleRow>
      <div className="toolbar">
        <SearchInput value={list.search} onChange={list.setSearch} label={t('Buscar nombre o documento')} />
        <span className="muted num">{formatNumber(list.meta?.total ?? 0)} {t('clientes')}</span>
      </div>
      <FormError error={destroy.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty={t('No se encontraron clientes.')}
        actions={(c) => (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(c)}>{t('Editar')}</button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(t('¿Eliminar a {name}?', { name: c.full_name })) && destroy.mutate(c.id)}>{t('Eliminar')}</button>
          </>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun={t('clientes')} />
      {editing !== null && <ClientForm key={editing === 'new' ? 'new' : editing.id} value={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

export function ClientFields({ form, setForm, error }: { form: ClientFormState; setForm: (f: ClientFormState) => void; error: unknown }) {
  const set = (key: keyof ClientFormState, filtro?: (v: string) => string) =>
    (e: { target: { value: string } }) => setForm({ ...form, [key]: filtro ? filtro(e.target.value) : e.target.value })

  // El DNI y el carné de extranjería son numéricos; el pasaporte lleva letras y números.
  const documento = {
    DNI: { filtro: soloNumeros, max: 8, regla: t('Obligatorio. Solo números, 8 dígitos.') },
    CE: { filtro: soloNumeros, max: 12, regla: t('Obligatorio. Solo números, entre 8 y 12.') },
    PASAPORTE: { filtro: (v: string) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), max: 20, regla: t('Obligatorio. Letras y números, hasta 20.') },
  }[form.document_type] ?? { filtro: soloNumeros, max: 8, regla: t('Obligatorio. Solo números, 8 dígitos.') }

  return (
    <>
      <Field className="full" label={t('Nombre completo')} hint={t('Obligatorio. Solo letras, hasta 120.')} required maxLength={120}
        value={form.full_name} onChange={set('full_name', soloLetras)} error={fieldError(error, 'full_name')} />
      <SelectField label={t('Tipo de documento')} hint={t('Obligatorio.')} value={form.document_type} onChange={set('document_type')}
        options={[{ value: 'DNI', label: 'DNI' }, { value: 'PASAPORTE', label: t('Pasaporte') }, { value: 'CE', label: t('Carné de extranjería') }]} />
      <Field label={t('Número de documento')} hint={documento.regla} required maxLength={documento.max}
        inputMode={form.document_type === 'PASAPORTE' ? 'text' : 'numeric'}
        value={form.document_number} onChange={set('document_number', documento.filtro)} error={fieldError(error, 'document_number')} />
      <Field label={t('Teléfono')} hint={t('Opcional. Solo números, entre 6 y 15.')} type="tel" inputMode="numeric" maxLength={15}
        value={form.phone} onChange={set('phone', soloNumeros)} error={fieldError(error, 'phone')} />
      <Field label={t('Nacionalidad')} hint={t('Opcional. Solo letras, hasta 60.')} maxLength={60}
        value={form.nationality} onChange={set('nationality', soloLetras)} error={fieldError(error, 'nationality')} />
    </>
  )
}

export interface ClientFormState {
  full_name: string
  document_type: string
  document_number: string
  phone: string
  nationality: string
}

export const clientFormFrom = (c?: Client | null): ClientFormState => ({
  full_name: c?.full_name ?? '',
  document_type: c?.document_type ?? 'DNI',
  document_number: c?.document_number ?? '',
  phone: c?.phone ?? '',
  nationality: c?.nationality ?? 'Perú',
})

function ClientForm({ value, onClose }: { value: Client | 'new' | null; onClose: () => void }) {
  const current = value && value !== 'new' ? value : null
  const [form, setForm] = useState(() => clientFormFrom(current))

  const save = useAction(() => (current ? send('put', `/clients/${current.id}`, form) : send('post', '/clients', form)), {
    invalidate: ['clients'],
    success: t('Cliente guardado.'),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Modal open={value !== null} title={current ? current.full_name : t('Nuevo cliente')} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>{t('Cancelar')}</button><button className="btn btn-primary" form="client-form" disabled={save.isPending}>{t('Guardar')}</button></>}>
      <FormError error={save.error} />
      <form id="client-form" className="form-grid" onSubmit={submit}>
        <ClientFields form={form} setForm={setForm} error={save.error} />
      </form>
    </Modal>
  )
}
