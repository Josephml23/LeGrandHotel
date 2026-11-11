import { useState, type FormEvent } from 'react'
import { send } from '../lib/api'
import { useAction } from '../lib/hooks'
import { Field, FormError, Modal, PasswordField, SelectField, fieldError, soloLetras } from '../components/ui'
import { t } from '../lib/i18n'

/**
 * Alta de una persona del hotel: crea de una vez su ficha y la cuenta con la que entra.
 * El cargo sale del rol (Administrador, Recepcionista o Almacenero), así que no se pide aparte.
 * El rol de Programador no se ofrece: el hotel tiene uno solo.
 */
export function StaffForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'receptionist',
    hired_at: new Date().toISOString().slice(0, 10),
  })

  const save = useAction(() => send('post', '/staff', form), {
    invalidate: ['staff', 'users'],
    success: t('Personal guardado.'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(undefined, { onSuccess: onClose })
  }
  const set = (key: keyof typeof form, filtro?: (v: string) => string) =>
    (e: { target: { value: string } }) => setForm({ ...form, [key]: filtro ? filtro(e.target.value) : e.target.value })
  const err = (k: string) => fieldError(save.error, k)

  return (
    <Modal open={open} title={t('Agregar persona')} onClose={() => { save.reset(); onClose() }}
      footer={<><button className="btn" onClick={onClose}>{t('Cancelar')}</button><button className="btn btn-primary" form="staff-form" disabled={save.isPending}>{t('Guardar')}</button></>}>
      <FormError error={save.error} />
      <form id="staff-form" className="form-grid" onSubmit={submit}>
        <Field className="full" label={t('Nombre completo')} hint={t('Obligatorio. Solo letras, hasta 120.')} required maxLength={120}
          value={form.name} onChange={set('name', soloLetras)} error={err('name')} />
        <Field label={t('Correo')} hint={t('Obligatorio. Correo válido, sin repetir.')} type="email" required
          value={form.email} onChange={set('email')} error={err('email')} />
        <PasswordField label={t('Contraseña')} required value={form.password}
          onChange={(valor) => setForm({ ...form, password: valor })} error={err('password')} />
        <SelectField label={t('Rol')} hint={t('Obligatorio. De aquí sale su cargo.')} value={form.role} onChange={set('role')} error={err('role')}
          options={[{ value: 'receptionist', label: t('Recepcionista') }, { value: 'storekeeper', label: t('Almacenero') }, { value: 'admin', label: t('Administrador') }]} />
        <Field label={t('Fecha de ingreso')} hint={t('Obligatorio. Hoy o antes.')} type="date" required max={new Date().toISOString().slice(0, 10)}
          value={form.hired_at} onChange={set('hired_at')} error={err('hired_at')} />
      </form>
    </Modal>
  )
}
