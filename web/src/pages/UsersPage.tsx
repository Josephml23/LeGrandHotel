import { useState, type FormEvent } from 'react'
import { send } from '../lib/api'
import { formatDate, formatNumber } from '../lib/format'
import { remove, useAction, useServerList } from '../lib/hooks'
import { useAuth } from '../auth/AuthContext'
import { DataTable, Field, FormError, Modal, Pagination, PasswordField, Pill, SearchInput, TitleRow, fieldError, soloLetras, type Column } from '../components/ui'
import { ROLE_LABELS, type RoleName, type UserRow } from '../types'
import { StaffForm } from './StaffForm'
import { t } from '../lib/i18n'

/** Pestañas del listado: el personal del hotel y los clientes (que entran con Google). */
const ALL_ROLES = Object.keys(ROLE_LABELS) as RoleName[]

/**
 * Personal y usuarios en una sola pantalla: todas las cuentas del sistema, las del equipo del
 * hotel y las de los clientes. «Agregar persona» crea la ficha y su cuenta de una sola vez.
 */
export function UsersPage() {
  const { user: me } = useAuth()
  const [role, setRole] = useState<'' | RoleName>('')
  const list = useServerList<UserRow>('users', { role })
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [creating, setCreating] = useState(false)
  const destroy = useAction(remove('users'), { invalidate: ['users', 'staff'], success: t('Usuario eliminado.') })

  const columns: Column<UserRow>[] = [
    { key: 'name', header: t('Usuario'), render: (u) => <span className="identity"><strong>{u.name}</strong><span>{u.email}</span></span> },
    { key: 'roles', header: t('Roles'), render: (u) => u.roles.map((r) => ROLE_LABELS[r.name]).join(', ') || <span className="muted">—</span> },
    { key: 'hired', header: t('Ingreso'), className: 'hide-sm', render: (u) => (u.staff ? <span className="num">{formatDate(u.staff.hired_at)}</span> : <span className="muted">—</span>) },
    { key: 'verified', header: t('Correo'), className: 'hide-sm', render: (u) => (u.email_verified_at ? <Pill tone="positive">{t('Verificado')}</Pill> : <Pill tone="warning">{t('Sin verificar')}</Pill>) },
  ]

  return (
    <>
      <TitleRow title={t('Personal y usuarios')} lede={t('Todas las cuentas del sistema. Al cambiar los roles de alguien se cierran sus sesiones abiertas.')}>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>{t('Agregar persona')}</button>
      </TitleRow>
      <div className="tabs" role="tablist" aria-label={t('Filtrar por rol')}>
        {(['', ...ALL_ROLES] as const).map((r) => (
          <button key={r} role="tab" className="tab" aria-selected={role === r} onClick={() => { setRole(r); list.setPage(1) }}>{r ? ROLE_LABELS[r] : t('Todos')}</button>
        ))}
      </div>
      <div className="toolbar">
        <SearchInput value={list.search} onChange={list.setSearch} label={t('Buscar nombre o correo')} />
        <span className="muted num">{formatNumber(list.meta?.total ?? 0)} {t('usuarios')}</span>
      </div>
      <FormError error={destroy.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty={t('No hay usuarios con este filtro.')}
        actions={(u) => (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(u)}>{t('Editar')}</button>
            {u.id !== me?.id && (
              <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(t('¿Eliminar la cuenta de {name}?', { name: u.name })) && destroy.mutate(u.id)}>{t('Eliminar')}</button>
            )}
          </>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun={t('usuarios')} />
      {creating && <StaffForm open onClose={() => setCreating(false)} />}
      {editing && <UserForm key={editing.id} value={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function UserForm({ value: current, onClose }: { value: UserRow; onClose: () => void }) {
  // Una cuenta de cliente entra con Google y no tiene contraseña; el personal, al revés.
  const eraCliente = !!current.roles.some((r) => r.name === 'client')
  const hoy = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState(() => ({
    name: current.name,
    email: current.email,
    password: '',
    roles: current.roles.map((r) => r.name),
    hired_at: current.staff?.hired_at.slice(0, 10) ?? '',
  }))

  const seraCliente = form.roles.includes('client')
  // Al pasar de cliente a personal hay que poner una contraseña: hasta ahora entraba con Google.
  const claveObligatoria = eraCliente && !seraCliente

  const save = useAction(async () => {
    const body: Record<string, string> = { name: form.name, email: form.email }
    // La contraseña de quien ya es personal se cambia en la cuenta; la de una promoción viaja
    // junto con los roles, para que el cambio entero sea una sola operación.
    if (form.password && !eraCliente) body.password = form.password
    await send('put', `/users/${current.id}`, body)
    // La fecha de ingreso vive en la ficha de personal, no en la cuenta.
    if (current.staff && form.hired_at !== current.staff.hired_at.slice(0, 10)) {
      await send('put', `/staff/${current.staff.id}`, { hired_at: form.hired_at })
    }
    const roles: Record<string, unknown> = { roles: form.roles }
    if (form.password && claveObligatoria) roles.password = form.password
    return send('put', `/users/${current.id}/roles`, roles)
  }, { invalidate: ['users', 'staff'], success: t('Usuario guardado.') })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }

  /** Cliente y personal se excluyen: un huésped no trabaja en el hotel. */
  const toggle = (role: RoleName) =>
    setForm((f) => {
      if (role === 'client') return { ...f, roles: f.roles.includes('client') ? [] : ['client' as RoleName] }
      const sinCliente = f.roles.filter((r) => r !== 'client')
      return { ...f, roles: sinCliente.includes(role) ? sinCliente.filter((r) => r !== role) : [...sinCliente, role] }
    })

  return (
    <Modal open title={current.name} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>{t('Cancelar')}</button><button className="btn btn-primary" form="user-form" disabled={save.isPending || form.roles.length === 0}>{t('Guardar')}</button></>}>
      <FormError error={save.error} />
      <form id="user-form" className="form-grid" onSubmit={submit}>
        <Field className="full" label={t('Nombre')} hint={t('Obligatorio. Solo letras, hasta 120.')} required maxLength={120}
          value={form.name} onChange={(e) => setForm({ ...form, name: soloLetras(e.target.value) })} error={fieldError(save.error, 'name')} />
        <Field label={t('Correo')} hint={t('Obligatorio. Correo válido, sin repetir.')} type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldError(save.error, 'email')} />
        {claveObligatoria && (
          <p className="full muted small" style={{ margin: 0 }}>{t('Pasa de cliente a personal: ponle una contraseña, porque el personal entra con correo y contraseña, no con Google.')}</p>
        )}
        {seraCliente ? (
          <p className="full muted small" style={{ margin: 0 }}>{t('Cuenta de cliente: entra con Google con este correo y no usa contraseña.')}</p>
        ) : (
          <PasswordField label={claveObligatoria ? t('Contraseña') : t('Nueva contraseña (opcional)')} value={form.password}
            required={claveObligatoria}
            onChange={(valor) => setForm({ ...form, password: valor })} error={fieldError(save.error, 'password')} />
        )}
        {current.staff && (
          <Field label={t('Fecha de ingreso')} hint={t('Obligatorio. Hoy o antes.')} type="date" required max={hoy}
            value={form.hired_at} onChange={(e) => setForm({ ...form, hired_at: e.target.value })} error={fieldError(save.error, 'hired_at')} />
        )}
        <fieldset className="full field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 500, marginBottom: 6 }}>{t('Roles')}</legend>
          <div className="actions">
            {ALL_ROLES.map((r) => (
              <label key={r} className="btn btn-sm" style={{ background: form.roles.includes(r) ? 'var(--active)' : undefined }}>
                {/* El Programador es único: no se da ni se quita desde aquí. */}
                <input type="checkbox" checked={form.roles.includes(r)} disabled={r === 'developer'} onChange={() => toggle(r)} /> {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
          <span className="muted small">{t('Cliente y personal se excluyen. El rol de Programador no se asigna ni se quita: el hotel tiene un solo Programador.')}</span>
          {fieldError(save.error, 'roles') && <span className="error">{fieldError(save.error, 'roles')}</span>}
        </fieldset>
      </form>
    </Modal>
  )
}
