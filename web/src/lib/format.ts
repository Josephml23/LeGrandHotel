import { intlLocale, t, translated } from './i18n'

// Los formatos siguen el idioma elegido (es-PE o en-US); el monto siempre es en soles.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>()
function formatter<T extends Intl.NumberFormat | Intl.DateTimeFormat>(name: string, make: (locale: string) => T): T {
  const key = `${name}:${intlLocale()}`
  if (!cache.has(key)) cache.set(key, make(intlLocale()))
  return cache.get(key) as T
}

export const formatMoney = (value: number | string) =>
  formatter('money', (l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'PEN' })).format(Number(value))

export const formatNumber = (value: number) => formatter('number', (l) => new Intl.NumberFormat(l)).format(value)

/** Fechas YYYY-MM-DD de la API sin desfase de zona horaria. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return formatter('date', (l) => new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', year: 'numeric' })).format(new Date(y, m - 1, d))
}

export const formatDateTime = (value: string | null | undefined) =>
  value
    ? formatter('dateTime', (l) => new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })).format(new Date(value))
    : '—'

export function nights(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`)
  const b = Date.parse(`${checkOut}T00:00:00Z`)
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Tone = 'positive' | 'negative' | 'warning' | 'neutral' | 'accent'

/** Estado con su etiqueta (traducida al leerla) y su color. */
const status = (label: string, tone: Tone) => ({
  get label() {
    return t(label)
  },
  tone,
})

export const ROOM_STATUS: Record<string, { label: string; tone: Tone }> = {
  available: status('Libre', 'positive'),
  occupied: status('Ocupada', 'accent'),
  cleaning: status('Limpieza', 'warning'),
  maintenance: status('Mantenimiento', 'neutral'),
}

export const RESERVATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: status('Por confirmar', 'warning'),
  confirmed: status('Confirmada', 'positive'),
  checked_in: status('Hospedado', 'accent'),
  completed: status('Finalizada', 'neutral'),
  cancelled: status('Cancelada', 'negative'),
}

export const SHIFT_LABEL: Record<string, string> = translated({ morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' })
