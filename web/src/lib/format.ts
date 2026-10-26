const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const date = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const formatMoney = (value: number | string) => money.format(Number(value))

/** Fechas YYYY-MM-DD de la API sin desfase de zona horaria. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return date.format(new Date(y, m - 1, d))
}

export const formatDateTime = (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : '—')

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

export const ROOM_STATUS: Record<string, { label: string; tone: 'positive' | 'negative' | 'warning' | 'neutral' | 'accent' }> = {
  available: { label: 'Libre', tone: 'positive' },
  occupied: { label: 'Ocupada', tone: 'accent' },
  cleaning: { label: 'Limpieza', tone: 'warning' },
  maintenance: { label: 'Mantenimiento', tone: 'neutral' },
}

export const RESERVATION_STATUS: Record<string, { label: string; tone: 'positive' | 'negative' | 'warning' | 'neutral' | 'accent' }> = {
  pending: { label: 'Por confirmar', tone: 'warning' },
  confirmed: { label: 'Confirmada', tone: 'positive' },
  checked_in: { label: 'Hospedado', tone: 'accent' },
  completed: { label: 'Finalizada', tone: 'neutral' },
  cancelled: { label: 'Cancelada', tone: 'negative' },
}

export const SHIFT_LABEL: Record<string, string> = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' }
