import { Field, fieldError } from '../../components/ui'
import { t } from '../../lib/i18n'
import type { AuthUser } from '../../types'

export interface ProfileForm {
  full_name: string
  document_number: string
  phone: string
}

/** Datos actuales del cliente; el nombre de Google sirve de punto de partida. */
export const profileFrom = (user: AuthUser | null): ProfileForm => ({
  full_name: user?.client?.full_name ?? user?.name ?? '',
  document_number: user?.client?.document_number ?? '',
  phone: user?.client?.phone ?? '',
})

/** Lo que la API recibe: los campos vacíos van como null (el DNI y el celular son opcionales). */
export const profilePayload = (form: ProfileForm) => ({
  full_name: form.full_name.trim(),
  document_number: form.document_number || null,
  phone: form.phone || null,
})

/** Para reservar hacen falta los tres datos con su formato. */
export const profileReady = (form: ProfileForm) =>
  form.full_name.trim().length >= 3 && /^\d{8}$/.test(form.document_number) && /^9\d{8}$/.test(form.phone)

const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)

/** Nombre completo, DNI y celular del cliente (lo usan el registro, Mi perfil y la reserva). */
export function ProfileFields({
  form,
  onChange,
  error,
  required,
}: {
  form: ProfileForm
  onChange: (form: ProfileForm) => void
  error: unknown
  required?: boolean
}) {
  const optional = required ? undefined : t('Opcional')
  return (
    <>
      <Field label={t('Nombre completo')} autoComplete="name" required value={form.full_name}
        onChange={(e) => onChange({ ...form, full_name: e.target.value })} error={fieldError(error, 'full_name')} />
      <Field label={t('DNI')} inputMode="numeric" autoComplete="off" required={required} value={form.document_number}
        placeholder={t('8 dígitos')} hint={optional}
        onChange={(e) => onChange({ ...form, document_number: digits(e.target.value, 8) })} error={fieldError(error, 'document_number')} />
      <Field label={t('Celular')} type="tel" inputMode="numeric" autoComplete="tel" required={required} value={form.phone}
        placeholder={t('9 dígitos, empieza con 9')} hint={optional}
        onChange={(e) => onChange({ ...form, phone: digits(e.target.value, 9) })} error={fieldError(error, 'phone')} />
    </>
  )
}
