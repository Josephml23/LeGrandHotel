import { useState, type FormEvent } from 'react'
import { send } from '../lib/api'
import { remove, useAction, useServerList } from '../lib/hooks'
import { formatDate, SHIFT_LABEL } from '../lib/format'
import { DataTable, Field, FormError, Modal, Pagination, SearchInput, SelectField, TitleRow, fieldError, type Column } from '../components/ui'
import { ROLE_LABELS, type Staff } from '../types'

export function StaffPage() {
  const list = useServerList<Staff>('staff')
  const [editing, setEditing] = useState<Staff | 'new' | null>(null)
  const destroy = useAction(remove('staff'), { invalidate: ['staff', 'users'], success: 'Ficha y cuenta eliminadas.' })

  const columns: Column<Staff>[] = [
    { key: 'name', header: 'Nombre', render: (s) => <span className="identity"><strong>{s.user.name}</strong><span>{s.user.email}</span></span> },
    { key: 'position', header: 'Cargo', render: (s) => s.position },
    { key: 'role', header: 'Rol en el sistema', className: 'hide-sm', render: (s) => s.user.roles.map((r) => ROLE_LABELS[r.name]).join(', ') },
    { key: 'shift', header: 'Turno', render: (s) => SHIFT_LABEL[s.shift] },
    { key: 'hired', header: 'Ingreso', className: 'hide-sm', render: (s) => <span className="num">{formatDate(s.hired_at)}</span> },
  ]

  return (
    <>
      <TitleRow title="Personal" lede="Cada persona del equipo tiene su cuenta y un rol: Administrador, Recepcionista o Almacenero.">
        <button className="btn btn-primary" onClick={() => setEditing('new')}>Agregar persona</button>
      </TitleRow>
      <div className="toolbar">
        <SearchInput value={list.search} onChange={list.setSearch} label="Buscar nombre o correo" />
        <span className="muted num">{list.meta?.total ?? 0} personas</span>
      </div>
      <FormError error={destroy.error} />
      <DataTable columns={columns} rows={list.rows} loading={list.isLoading} error={list.error} empty="Aún no hay personal registrado."
        actions={(s) => (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(s)}>Editar</button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => confirm(`¿Eliminar a ${s.user.name} y su cuenta?`) && destroy.mutate(s.id)}>Eliminar</button>
          </>
        )} />
      <Pagination meta={list.meta} onPage={list.setPage} noun="personas" />
      {editing !== null && <StaffForm key={editing === 'new' ? 'new' : editing.id} value={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function StaffForm({ value, onClose }: { value: Staff | 'new' | null; onClose: () => void }) {
  const current = value && value !== 'new' ? value : null
  const isDeveloper = !!current?.user.roles.some((r) => r.name === 'developer')
  const blank ={ name: '', email: '', password: '', role: 'receptionist', position: 'Recepcionista', shift: 'morning', hired_at: new Date().toISOString().slice(0, 10) }
  const [form, setForm] = useState(() => (current ? {
    name: current.user.name,
    email: current.user.email,
    password: '',
    role: current.user.roles.some((r) => r.name === 'developer') ? 'developer' : current.user.roles[0]?.name ?? 'receptionist',
    position: current.position,
    shift: current.shift,
    hired_at: current.hired_at.slice(0, 10),
  } : blank))

  const save = useAction(() => {
    const body: Record<string, string> = { ...form }
    if (current && !body.password) delete body.password
    return current ? send('put', `/staff/${current.id}`, body) : send('post', '/staff', body)
  }, { invalidate: ['staff', 'users'], success: 'Personal guardado.' })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }
  const set = (key: keyof typeof blank) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })
  const err = (k: string) => fieldError(save.error, k)

  return (
    <Modal open={value !== null} title={current ? current.user.name : 'Agregar persona'} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" form="staff-form" disabled={save.isPending}>Guardar</button></>}>
      <FormError error={save.error} />
      <form id="staff-form" className="form-grid" onSubmit={submit}>
        <Field className="full" label="Nombre completo" required value={form.name} onChange={set('name')} error={err('name')} />
        <Field label="Correo" type="email" required value={form.email} onChange={set('email')} error={err('email')} />
        <Field label={current ? 'Nueva contraseña (opcional)' : 'Contraseña'} type="password" autoComplete="new-password" value={form.password} onChange={set('password')}
          error={err('password')} hint="Mínimo 8 caracteres, con letras y números." />
        {isDeveloper ? (
          // El Programador es único: su ficha se edita, pero su rol no cambia.
          <SelectField label="Rol" value="developer" onChange={set('role')} disabled options={[{ value: 'developer', label: 'Programador' }]}
            hint="El rol de Programador no se cambia." />
        ) : (
          <SelectField label="Rol" value={form.role} onChange={set('role')} error={err('role')}
            options={[{ value: 'receptionist', label: 'Recepcionista' }, { value: 'storekeeper', label: 'Almacenero' }, { value: 'admin', label: 'Administrador' }]} />
        )}
        <Field label="Cargo" required value={form.position} onChange={set('position')} error={err('position')} />
        <SelectField label="Turno" value={form.shift} onChange={set('shift')} options={Object.entries(SHIFT_LABEL).map(([value, label]) => ({ value, label }))} />
        <Field label="Fecha de ingreso" type="date" required value={form.hired_at} onChange={set('hired_at')} error={err('hired_at')} />
      </form>
    </Modal>
  )
}
