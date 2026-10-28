import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOne } from '../lib/api'
import { addDaysISO, formatDate, formatMoney, formatNumber, todayISO } from '../lib/format'
import { intlLocale, t } from '../lib/i18n'
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

const label = (ym: string) => new Intl.DateTimeFormat(intlLocale(), { month: 'short', year: '2-digit' }).format(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1))

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
        title={t('Reportes')}
        lede={t('Ocupación del rango elegido e ingresos de los últimos seis meses.')}
        finding={o ? t('Del {from} al {to} se vendieron {nights} noches: {rate}% de ocupación.', { from: formatDate(o.from), to: formatDate(o.to), nights: formatNumber(o.nights_sold), rate: o.occupancy_rate }) : undefined}
      >
        <Field label={t('Desde')} type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Field label={t('Hasta')} type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </TitleRow>

      <div className="stack enter">
        <div className="kpis">
          <Kpi label={t('Ocupación del rango')} value={o ? `${o.occupancy_rate}%` : '—'} caption={o ? t('{nights} noches de {rooms} habitaciones', { nights: o.nights_sold, rooms: o.total_rooms }) : undefined} />
          <Kpi label={t('Ocupadas ahora')} value={o ? t('{n} de {total}', { n: o.occupied_now, total: o.total_rooms }) : '—'} caption={o ? t('{rate}% en este momento', { rate: o.current_occupancy_rate }) : undefined} />
          <Kpi label={t('Ingresos, 6 meses')} value={income.data ? formatMoney(income.data.total_income) : '—'} caption={t('Reservas confirmadas, en curso y cerradas')} />
          <Kpi label={t('Mejor mes')} value={best ? label(best.month) : '—'} caption={best ? t('{amount} en {n} reservas', { amount: formatMoney(best.income), n: best.reservations }) : t('Sin ingresos en el periodo')} />
        </div>

        <section className="card" aria-labelledby="income-title">
          <h2 id="income-title" className="section-title">{t('Ingresos por mes (S/)')}</h2>
          {months.length === 0 ? (
            <p className="muted">{income.isLoading ? t('Cargando…') : t('No hay ingresos registrados en los últimos seis meses.')}</p>
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
      <div className="bars" role="img" aria-label={t('Ingresos mensuales en soles')}>
        {months.map((m) => (
          <button key={m.month} type="button" className="bar" aria-label={`${label(m.month)}: ${formatMoney(m.income)}, ${t('{n} reservas', { n: m.reservations })}`}>
            <span className="fill" style={{ height: `${(m.income / max) * 100}%` }} />
            {highlight.includes(m.month) && (
              <span className="value num" style={{ bottom: `${(m.income / max) * 100}%` }}>{formatMoney(m.income)}</span>
            )}
            <span className="tip num">{label(m.month)} · {formatMoney(m.income)} · {t('{n} reservas', { n: m.reservations })}</span>
          </button>
        ))}
      </div>
      <div className="axis" aria-hidden="true">{months.map((m) => <span key={m.month}>{label(m.month)}</span>)}</div>
      <details style={{ marginTop: 12 }}>
        <summary className="muted">{t('Ver como tabla')}</summary>
        <table className="data">
          <thead><tr><th scope="col">{t('Mes')}</th><th className="right" scope="col">{t('Reservas')}</th><th className="right" scope="col">{t('Ingresos')}</th></tr></thead>
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
