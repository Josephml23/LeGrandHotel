import { useId } from 'react'
import { prefsStore, t, usePrefs, type Lang, type Theme } from '../lib/i18n'

/** Grupo de opciones excluyentes con aspecto de botones (radio nativo: teclado y lector de pantalla). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  compact,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  compact?: boolean
}) {
  const name = useId()
  return (
    <div className={`segmented ${compact ? 'compact' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className={option.value === value ? 'on' : ''}>
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

export const themeOptions = (): { value: Theme; label: string }[] => [
  { value: 'light', label: t('Claro') },
  { value: 'dark', label: t('Oscuro') },
  { value: 'system', label: t('Según el sistema') },
]

/** Cambio rápido de idioma en las pantallas de acceso (antes de iniciar sesión). */
export function LanguageSwitch() {
  const { lang } = usePrefs()
  return (
    <Segmented compact label={t('Idioma')} value={lang} onChange={(next) => prefsStore.set({ lang: next })}
      options={LANGUAGES.map((l) => ({ value: l.value, label: l.value.toUpperCase() }))} />
  )
}
