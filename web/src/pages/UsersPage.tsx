import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { send } from '../lib/api'
import { remove, useAction, useServerList } from '../lib/hooks'
import { useAuth } from '../auth/AuthContext'
import { DataTable, Field, FormError, Modal, Pagination, Pill, SearchInput, TitleRow, fieldError, type Column } from '../components/ui'
import { ROLE_LABELS, STAFF_ROLES, type RoleName, type UserRow } from '../types'

/** Pestañas del listado: el personal y los clientes (que entran con Google). */
const ALL_ROLES = Object.keys(ROLE_LABELS) as RoleName[]

export function UsersPage() {
  const { user: me } = useAuth()
  const [role, setRole] = useState<'' | RoleName>('')
  const list = useServerList<UserRow>('users', { role })
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null)
  const destroy = useAction(remove('users'), { invalidate: ['users', 'staff'], success: 'Usuario eliminado.' })

  const columns: Column<UserRow>[] = [
    { key: 'name', header: 'Usuario', render: (u) => <span className="identity"><strong>{u.name}</strong><span>{u.email}</span></span> },
    { key: 'roles', header: 'Roles', render: (u) => u.roles.map((r) => ROLE_LABELS[r.name]).join(', ') || <span className="muted">—</span> },
    { key: 'verified', header: 'Correo', className: 'hide-sm', render: (u) => (u.email_verified_at ? <Pill tone="positive">Verificado</Pill> : <Pill tone="warning">Sin verificar</Pill>) },
  ]

  return (
    <>
      <TitleRow title="Usuarios y roles" lede="Al cambiar los roles de alguien se cierran sus sesiones abiertas.">
        <Link className="btn btn-primary" to="/registro">Registrar usuario</Link>
      </TitleRow>
      <div className="tabs" role="tablist" aria-label="Filtrar por rol">
        {(['', ...ALL_ROLES] as const).map((r) => (
          <button key={r} role="tab" className="tab" aria-selected={role === r} onClick={() => { setRole(r); list.setPage(1) }}>{r ? ROLE_LABELS[r] : 'Todos'}</button>
        ))}
      </div>
      <div className="toolbar">
        <SearchInput value={list.search} onChange={list.setSearch} label="Buscar nombre o correo" />
        <span className="muted num">{(list.meta?.total ?? 0).toLocaleString('es-PE')} usuarios</span>
      </div>
      <FormError error={destroy.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty="No hay usuarios con este filtro."
        actions={(u) => (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(u)}>Editar</button>
            {u.id !== me?.id && (
              <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(`¿Eliminar la cuenta de ${u.name}?`) && destroy.mutate(u.id)}>Eliminar</button>
            )}
          </>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun="usuarios" />
      {editing !== null && <UserForm key={editing === 'new' ? 'new' : editing.id} value={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function UserForm({ value, onClose }: { value: UserRow | 'new' | null; onClose: () => void }) {
  const current = value && value !== 'new' ? value : null
  // Una cuenta de cliente entra con Google: no tiene contraseña y sus roles no se editan aquí.
  const isClient = !!current?.roles.some((r) => r.name === 'client')
  const [form, setForm] = useState(() => ({
    name: current?.name ?? '',
    email: current?.email ?? '',
    password: '',
    roles: current ? current.roles.map((r) => r.name) : (['receptionist'] as RoleName[]),
  }))

  const save = useAction(async () => {
    if (!current) return send('post', '/users', form)
    const body: Record<string, string> = { name: form.name, email: form.email }
    if (form.password && !isClient) body.password = form.password
    const updated = await send('put', `/users/${current.id}`, body)
    return isClient ? updated : send('put', `/users/${current.id}/roles`, { roles: form.roles })
  }, { invalidate: ['users', 'staff'], success: 'Usuario guardado.' })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }
  const toggle = (role: RoleName) =>
    setForm((f) => ({ ...f, roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role] }))

  return (
    <Modal open={value !== null} title={current ? current.name : 'Nuevo usuario'} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" form="user-form" disabled={save.isPending || (!isClient && form.roles.length === 0)}>Guardar</button></>}>
      <FormError error={save.error} />
      <form id="user-form" className="form-grid" onSubmit={submit}>
        <Field className="full" label="Nombre" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError(save.error, 'name')} />
        <Field label="Correo" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldError(save.error, 'email')} />
        {isClient ? (
          <p className="full muted small" style={{ margin: 0 }}>Cuenta de cliente: entra con Google, no tiene contraseña y sus roles no se cambian desde aquí.</p>
        ) : (
          <Field label={current ? 'Nueva contraseña (opcional)' : 'Contraseña'} type="password" autoComplete="new-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} error={fieldError(save.error, 'password')} hint="Mínimo 8 caracteres, con letras y números." />
        )}
        {!isClient && <fieldset className="full field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 500, marginBottom: 6 }}>Roles</legend>
          <div className="actions">
            {STAFF_ROLES.map((r) => (
              <label key={r} className="btn btn-sm" style={{ background: form.roles.includes(r) ? 'var(--active)' : undefined }}>
                <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggle(r)} /> {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
          {fieldError(save.error, 'roles') && <span className="error">{fieldError(save.error, 'roles')}</span>}
        </fieldset>}
      </form>
    </Modal>
  )
}
