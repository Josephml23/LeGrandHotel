import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOne } from '../lib/api'
import { addDaysISO, formatDate, formatMoney, todayISO } from '../lib/format'
import { Field, Kpi, TitleRow } from '../components/ui'

interface Occupancy {
  from: string
  to: string
  total_rooms: number
  occupied_now: number
  current_occupancy_rate: number
  nights_sold: number
  occupancy_rate: number
  rooms_by_status: Record<string, number>
}

interface Income {
  from: string
  to: string
  total_income: number
  months: { month: string; reservations: number; income: number }[]
}

const monthName = new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' })
const label = (ym: string) => monthName.format(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1))

export function ReportsPage() {
  const [range, setRange] = useState({ from: addDaysISO(todayISO(), -30), to: todayISO() })
  const occupancy = useQuery({ queryKey: ['reports', 'occupancy', range], queryFn: () => getOne<Occupancy>('/reports/occupancy', range) })
  const income = useQuery({ queryKey: ['reports', 'income'], queryFn: () => getOne<Income>('/reports/income') })

  const o = occupancy.data
  const months = income.data?.months ?? []
  const best = months.reduce<Income['months'][number] | null>((a, m) => (!a || m.income > a.income ? m : a), null)

  return (
    <>
      <TitleRow
        title="Reportes"
        lede="Ocupación del rango elegido e ingresos de los últimos seis meses."
        finding={o ? `Del ${formatDate(o.from)} al ${formatDate(o.to)} se vendieron ${o.nights_sold.toLocaleString('es-PE')} noches: ${o.occupancy_rate}% de ocupación.` : undefined}
      >
        <Field label="Desde" type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Field label="Hasta" type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </TitleRow>

      <div className="stack enter">
        <div className="kpis">
          <Kpi label="Ocupación del rango" value={o ? `${o.occupancy_rate}%` : '—'} caption={o ? `${o.nights_sold} noches de ${o.total_rooms} habitaciones` : undefined} />
          <Kpi label="Ocupadas ahora" value={o ? `${o.occupied_now} de ${o.total_rooms}` : '—'} caption={o ? `${o.current_occupancy_rate}% en este momento` : undefined} />
          <Kpi label="Ingresos, 6 meses" value={income.data ? formatMoney(income.data.total_income) : '—'} caption="Reservas confirmadas, en curso y cerradas" />
          <Kpi label="Mejor mes" value={best ? label(best.month) : '—'} caption={best ? `${formatMoney(best.income)} en ${best.reservations} reservas` : 'Sin ingresos en el periodo'} />
        </div>

        <section className="card" aria-labelledby="income-title">
          <h2 id="income-title" className="section-title">Ingresos por mes (S/)</h2>
          {months.length === 0 ? (
            <p className="muted">{income.isLoading ? 'Cargando…' : 'No hay ingresos registrados en los últimos seis meses.'}</p>
          ) : (
            <IncomeBars months={months} highlight={[best?.month, months.at(-1)?.month]} />
          )}
        </section>
      </div>
    </>
  )
}

/** Una serie, un tono; etiqueta directa solo en el mejor mes y el actual; el detalle va en el tooltip y la tabla. */
function IncomeBars({ months, highlight }: { months: Income['months']; highlight: (string | undefined)[] }) {
  const max = Math.max(...months.map((m) => m.income), 1)
  return (
    <div className="chart">
      <div className="bars" role="img" aria-label="Ingresos mensuales en soles">
        {months.map((m) => (
          <button key={m.month} type="button" className="bar" aria-label={`${label(m.month)}: ${formatMoney(m.income)}, ${m.reservations} reservas`}>
            <span className="fill" style={{ height: `${(m.income / max) * 100}%` }} />
            {highlight.includes(m.month) && (
              <span className="value num" style={{ bottom: `${(m.income / max) * 100}%` }}>{formatMoney(m.income)}</span>
            )}
            <span className="tip num">{label(m.month)} · {formatMoney(m.income)} · {m.reservations} reservas</span>
          </button>
        ))}
      </div>
      <div className="axis" aria-hidden="true">{months.map((m) => <span key={m.month}>{label(m.month)}</span>)}</div>
      <details style={{ marginTop: 12 }}>
        <summary className="muted">Ver como tabla</summary>
        <table className="data">
          <thead><tr><th scope="col">Mes</th><th className="right" scope="col">Reservas</th><th className="right" scope="col">Ingresos</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}><td>{label(m.month)}</td><td className="right num">{m.reservations}</td><td className="right num">{formatMoney(m.income)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
