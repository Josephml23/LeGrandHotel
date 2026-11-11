import { useEffect, useId, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { useLocation } from 'react-router-dom'
import type { PageMeta } from '../types'
import { ApiError } from '../lib/api'
import { formatNumber } from '../lib/format'
import { t } from '../lib/i18n'
import { tourStore } from '../lib/tour'
import { tutorialDe } from '../lib/tutoriales'

type Tone = 'positive' | 'negative' | 'warning' | 'neutral' | 'accent'

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function TitleRow({ title, lede, finding, children }: { title: string; lede?: ReactNode; finding?: ReactNode; children?: ReactNode }) {
  return (
    <div className="title-row">
      <div>
        {/* El botón va al lado del título, no dentro: si no, cambiaría el nombre del encabezado. */}
        <div className="title-head">
          <h1>{title}</h1>
          <AyudaDePantalla />
        </div>
        {lede && <p className="lede">{lede}</p>}
        {finding && <p className="finding">{finding}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  )
}

/**
 * Botón «¿Qué hago aquí?» al lado del título: abre el tutorial de esta pantalla, que resalta
 * cada botón y explica qué hace. Solo aparece en las pantallas que tienen tutorial.
 */
function AyudaDePantalla() {
  const { pathname } = useLocation()
  if (!tutorialDe(pathname)) return null
  return (
    <button type="button" className="btn btn-sm btn-ghost ayuda" onClick={() => tourStore.start('pagina')}
      title={t('¿Qué hago aquí?')} aria-label={t('¿Qué hago aquí?')}>
      ?
    </button>
  )
}

/** Valor que se actualiza 300 ms después de la última tecla (evita una consulta por letra). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function SearchInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <input
      className="input search"
      type="search"
      placeholder={label}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  align?: 'right'
  className?: string
}

export function DataTable<T extends { id: number }>({
  columns,
  rows,
  loading,
  error,
  empty,
  actions,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  loading: boolean
  error?: unknown
  empty: string
  actions?: (row: T) => ReactNode
}) {
  const span = columns.length + (actions ? 1 : 0)

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={[c.align === 'right' ? 'right' : '', c.className ?? ''].join(' ')} scope="col">
                {c.header}
              </th>
            ))}
            {actions && <th className="right" scope="col"><span className="sr-only">{t('Acciones')}</span></th>}
          </tr>
        </thead>
        <tbody aria-busy={loading}>
          {loading &&
            Array.from({ length: 6 }, (_, i) => (
              <tr key={`sk-${i}`}>
                {Array.from({ length: span }, (_, j) => (
                  <td key={j}><span className="skeleton" style={{ width: `${40 + ((i * 7 + j * 13) % 50)}%` }} /></td>
                ))}
              </tr>
            ))}
          {!loading && error != null && (
            <tr><td colSpan={span}><span className="muted">{error instanceof ApiError ? error.message : t('No se pudo cargar la lista.')}</span></td></tr>
          )}
          {!loading && !error && rows?.length === 0 && (
            <tr><td colSpan={span}><span className="muted">{empty}</span></td></tr>
          )}
          {!loading &&
            !error &&
            rows?.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key} className={[c.align === 'right' ? 'right' : '', c.className ?? ''].join(' ')}>{c.render(row)}</td>
                ))}
                {actions && <td className="row-actions">{actions(row)}</td>}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ meta, onPage, noun }: { meta?: PageMeta; onPage: (page: number) => void; noun: string }) {
  if (!meta) return null
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.per_page + 1
  const to = Math.min(meta.page * meta.per_page, meta.total)
  return (
    <nav className="pagination" aria-label={t('Paginación')}>
      <span className="muted num">
        {t('{from}–{to} de {total}', { from, to, total: formatNumber(meta.total) })} {noun}
      </span>
      <div className="actions">
        <button className="btn btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>{t('Anterior')}</button>
        <span className="num small muted">{t('Página {page} de {pages}', { page: meta.page, pages: Math.max(meta.last_page, 1) })}</span>
        <button className="btn btn-sm" disabled={meta.page >= meta.last_page} onClick={() => onPage(meta.page + 1)}>{t('Siguiente')}</button>
      </div>
    </nav>
  )
}

export function Field({
  label,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field ${className ?? ''}`}>
      <FieldLabel id={id} label={label} hint={hint} />
      <input id={id} className="input" aria-invalid={!!error} aria-describedby={describedBy} {...props} />
      {error && <span id={`${id}-error`} className="error">{error}</span>}
    </div>
  )
}

/**
 * Filtros de escritura: la casilla descarta lo que no corresponde mientras se escribe, así el
 * usuario no llega a enviar algo inválido. La API valida lo mismo (ApiFormRequest::SOLO_LETRAS).
 */
export const soloLetras = (valor: string) => valor.replace(/[^\p{L}\p{M}\s'’.-]/gu, '')
export const soloNumeros = (valor: string) => valor.replace(/\D/g, '')

/** La etiqueta y, al costado, las reglas que debe cumplir el campo (en letra pequeña). */
function FieldLabel({ id, label, hint }: { id: string; label: string; hint?: string }) {
  return (
    <div className="field-head">
      <label htmlFor={id}>{label}</label>
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
    </div>
  )
}

/** Una contraseña cumple si tiene 8 caracteres o más, con al menos una letra y un número. */
export const claveValida = (valor: string) => /^(?=.*\p{L})(?=.*\d).{8,}$/u.test(valor)

/**
 * Contraseña con un botón para verla y la comprobación del mínimo a la vista: mientras no cumpla,
 * el aviso aparece en rojo y el navegador no deja enviar el formulario (patrón HTML).
 */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  required,
  className,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  error?: string
  required?: boolean
  className?: string
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const falta = value.length > 0 && !claveValida(value)
  const aviso = t('Mínimo 8 caracteres, con letras y números.')

  return (
    <div className={`field ${className ?? ''}`}>
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <span id={`${id}-hint`} className={falta ? 'error' : 'hint'}>{aviso}</span>
      </div>
      <div className="con-boton">
        <input
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required={required}
          value={value}
          minLength={8}
          pattern="(?=.*[\p{L}])(?=.*\d).{8,}"
          title={aviso}
          aria-invalid={!!error || falta}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn btn-sm" aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
          {visible ? t('Ocultar') : t('Ver')}
        </button>
      </div>
      {error && <span id={`${id}-error`} className="error">{error}</span>}
    </div>
  )
}

export function SelectField({
  label,
  error,
  hint,
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string; options: { value: string | number; label: string }[] }) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field ${className ?? ''}`}>
      <FieldLabel id={id} label={label} hint={hint} />
      <select id={id} className="select" aria-invalid={!!error} aria-describedby={describedBy} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span id={`${id}-error`} className="error">{error}</span>}
    </div>
  )
}

/** Diálogo nativo (<dialog>): foco atrapado y Esc para cerrar sin librerías. */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="modal-title">
      {open && (
        <>
          <div className="modal-head">
            <h2 id="modal-title">{title}</h2>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('Cerrar')}>{t('Cerrar')}</button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  )
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof ApiError ? error.message : t('No se pudo guardar. Intenta de nuevo.')
  return <div className="form-error" role="alert">{message}</div>
}

export function fieldError(error: unknown, name: string): string | undefined {
  return error instanceof ApiError ? error.field(name) : undefined
}

export function Kpi({ label, value, caption }: { label: string; value: ReactNode; caption?: ReactNode }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {caption && <span className="kpi-caption">{caption}</span>}
    </div>
  )
}

export function Mark({ size = 26 }: { size?: number }) {
  // Monograma: la llave de habitación de LeGrandHotel (L + paleta de llave).
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1b6c80" />
      <path d="M9 8h3v13h7v3H9z M20 8h3v9h-3z" fill="#fff" />
    </svg>
  )
}
