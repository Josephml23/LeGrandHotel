import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getList, getOne } from '../lib/api'
import { formatDate, formatMoney, todayISO } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { Kpi, Pill, TitleRow } from '../components/ui'
import type { InventoryItem, Reservation, Room } from '../types'
import { RoomRack } from '../components/RoomRack'
import { intlLocale, t } from '../lib/i18n'

interface Dashboard {
  rooms?: { total: number; occupied: number; available: number; cleaning: number; occupancy_rate: number }
  today?: { check_ins: number; check_outs: number }
  income_month?: number
  low_stock?: InventoryItem[]
  low_stock_count?: number
}

const today = todayISO

/**
 * Pregunta del panel: ¿quién llega y quién se va hoy, y qué habitaciones están listas?
 */
export function DashboardPage() {
  const { user, hasRole } = useAuth()
  const isDesk = hasRole('admin', 'receptionist')

  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => getOne<Dashboard>('/dashboard') })
  const rooms = useQuery({
    queryKey: ['rooms', 'rack'],
    queryFn: () => getList<Room>('/rooms', { per_page: 50 }),
    enabled: isDesk,
  })
  const arrivals = useQuery({
    queryKey: ['reservations', 'arrivals', today()],
    queryFn: () => getList<Reservation>('/reservations', { check_in: today(), per_page: 6, status: 'confirmed' }),
    enabled: isDesk,
  })

  const d = dashboard.data
  const firstName = user?.name.split(' ')[0] ?? ''
  const finding = d?.today
    ? `${plural(d.today.check_ins, t('Hoy llega 1 huésped'), t('Hoy llegan {n} huéspedes', { n: d.today.check_ins }))} ${t('y salen {n};', { n: d.today.check_outs })} ${plural(d.rooms?.cleaning ?? 0, t('1 habitación espera limpieza.'), t('{n} habitaciones esperan limpieza.', { n: d.rooms?.cleaning ?? 0 }))}`
    : undefined

  return (
    <>
      <TitleRow title={t('Panel de {name}', { name: firstName })} lede={new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'full' }).format(new Date())} finding={finding}>
        {isDesk && <Link className="btn btn-primary" to="/reservas?nueva=1">{t('Nueva reserva')}</Link>}
        {hasRole('storekeeper') && !isDesk && <Link className="btn btn-primary" to="/inventario">{t('Registrar movimiento')}</Link>}
      </TitleRow>

      <div className="overview enter">
        <div className="stack">
          {d?.rooms && (
            <div className="kpis">
              <Kpi label={t('Ocupación ahora')} value={`${d.rooms.occupancy_rate}%`} caption={t('{n} de {total} habitaciones', { n: d.rooms.occupied, total: d.rooms.total })} />
              <Kpi label={t('Libres')} value={d.rooms.available} caption={t('Listas para asignar')} />
              <Kpi label={t('Llegadas hoy')} value={d.today?.check_ins ?? 0} caption={t('Salidas hoy: {n}', { n: d.today?.check_outs ?? 0 })} />
              {d.income_month !== undefined ? (
                <Kpi label={t('Ingresos del mes')} value={formatMoney(d.income_month)} caption={t('Reservas confirmadas y cerradas')} />
              ) : (
                <Kpi label={t('En limpieza')} value={d.rooms.cleaning} caption={t('Pendientes de housekeeping')} />
              )}
            </div>
          )}

          {isDesk && (
            <section className="card" aria-labelledby="rack-title">
              <div className="toolbar">
                <h2 id="rack-title" className="section-title" style={{ margin: 0 }}>{t('Tablero de habitaciones')}</h2>
                <Link className="btn btn-sm" to="/habitaciones">{t('Ver todas')}</Link>
              </div>
              <RoomRack rooms={rooms.data?.data} loading={rooms.isLoading} />
            </section>
          )}

          {!isDesk && d?.low_stock && (
            <section className="card">
              <h2 className="section-title">{t('Insumos bajo el mínimo')}</h2>
              <LowStock items={d.low_stock} count={d.low_stock_count ?? 0} />
            </section>
          )}
        </div>

        <aside className="stack" aria-label={t('Resumen del día')}>
          {isDesk && (
            <section>
              <h2 className="section-title">{t('Llegadas de hoy')}{arrivals.data && arrivals.data.meta.total > 0 ? ` (${arrivals.data.meta.total})` : ''}</h2>
              <div className="card" style={{ padding: '4px 16px' }}>
                {arrivals.data?.data.length ? (
                  <ul className="list-rows">
                    {arrivals.data.data.map((r) => (
                      <li key={r.id}>
                        <span className="identity">
                          <strong>{r.client?.full_name}</strong>
                          <span>{t('Hab. {number} · hasta {date}', { number: r.room?.number ?? '—', date: formatDate(r.check_out) })}</span>
                        </span>
                        <Link className="btn btn-sm" to={`/reservas?checkin=${r.id}`}>{t('Check-in')}</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ padding: '12px 0' }}>{arrivals.isLoading ? t('Cargando…') : t('No hay llegadas pendientes para hoy.')}</p>
                )}
              </div>
            </section>
          )}

          {isDesk && d?.low_stock && (
            <section>
              <h2 className="section-title">{t('Insumos bajo el mínimo')}</h2>
              <div className="card" style={{ padding: '4px 16px' }}>
                <LowStock items={d.low_stock} count={d.low_stock_count ?? 0} />
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}

function LowStock({ items, count }: { items: InventoryItem[]; count: number }) {
  if (items.length === 0) return <p className="muted" style={{ padding: '12px 0' }}>{t('Todo el inventario está sobre su mínimo.')}</p>
  return (
    <>
      <ul className="list-rows">
        {items.map((item) => (
          <li key={item.id}>
            <span className="identity">
              <strong>{item.name}</strong>
              <span className="num">{t('{stock} de mínimo {min} {unit}', { stock: item.stock, min: item.min_stock, unit: item.unit })}</span>
            </span>
            <Pill tone={item.stock === 0 ? 'negative' : 'warning'}>{item.stock === 0 ? t('Agotado') : t('Reponer')}</Pill>
          </li>
        ))}
      </ul>
      {count > items.length && <Link className="btn btn-sm" style={{ margin: '8px 0 12px' }} to="/inventario">{t('Ver los {n}', { n: count })}</Link>}
    </>
  )
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
