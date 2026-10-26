import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getList, getOne } from '../lib/api'
import { formatDate, formatMoney, todayISO } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import { Kpi, Pill, TitleRow } from '../components/ui'
import type { InventoryItem, Reservation, Room } from '../types'
import { RoomRack } from '../components/RoomRack'

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
    ? `Hoy llegan ${d.today.check_ins} ${plural(d.today.check_ins, 'huésped', 'huéspedes')} y salen ${d.today.check_outs}; ${d.rooms?.cleaning ?? 0} ${plural(d.rooms?.cleaning ?? 0, 'habitación espera', 'habitaciones esperan')} limpieza.`
    : undefined

  return (
    <>
      <TitleRow title={`Panel de ${firstName}`} lede={new Intl.DateTimeFormat('es-PE', { dateStyle: 'full' }).format(new Date())} finding={finding}>
        {isDesk && <Link className="btn btn-primary" to="/reservas?nueva=1">Nueva reserva</Link>}
        {hasRole('storekeeper') && !isDesk && <Link className="btn btn-primary" to="/inventario">Registrar movimiento</Link>}
      </TitleRow>

      <div className="overview enter">
        <div className="stack">
          {d?.rooms && (
            <div className="kpis">
              <Kpi label="Ocupación ahora" value={`${d.rooms.occupancy_rate}%`} caption={`${d.rooms.occupied} de ${d.rooms.total} habitaciones`} />
              <Kpi label="Libres" value={d.rooms.available} caption="Listas para asignar" />
              <Kpi label="Llegadas hoy" value={d.today?.check_ins ?? 0} caption={`Salidas hoy: ${d.today?.check_outs ?? 0}`} />
              {d.income_month !== undefined ? (
                <Kpi label="Ingresos del mes" value={formatMoney(d.income_month)} caption="Reservas confirmadas y cerradas" />
              ) : (
                <Kpi label="En limpieza" value={d.rooms.cleaning} caption="Pendientes de housekeeping" />
              )}
            </div>
          )}

          {isDesk && (
            <section className="card" aria-labelledby="rack-title">
              <div className="toolbar">
                <h2 id="rack-title" className="section-title" style={{ margin: 0 }}>Tablero de habitaciones</h2>
                <Link className="btn btn-sm" to="/habitaciones">Ver todas</Link>
              </div>
              <RoomRack rooms={rooms.data?.data} loading={rooms.isLoading} />
            </section>
          )}

          {!isDesk && d?.low_stock && (
            <section className="card">
              <h2 className="section-title">Insumos bajo el mínimo</h2>
              <LowStock items={d.low_stock} count={d.low_stock_count ?? 0} />
            </section>
          )}
        </div>

        <aside className="stack" aria-label="Resumen del día">
          {isDesk && (
            <section>
              <h2 className="section-title">Llegadas de hoy{arrivals.data && arrivals.data.meta.total > 0 ? ` (${arrivals.data.meta.total})` : ''}</h2>
              <div className="card" style={{ padding: '4px 16px' }}>
                {arrivals.data?.data.length ? (
                  <ul className="list-rows">
                    {arrivals.data.data.map((r) => (
                      <li key={r.id}>
                        <span className="identity">
                          <strong>{r.client?.full_name}</strong>
                          <span>Hab. {r.room?.number} · hasta {formatDate(r.check_out)}</span>
                        </span>
                        <Link className="btn btn-sm" to={`/reservas?checkin=${r.id}`}>Check-in</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ padding: '12px 0' }}>{arrivals.isLoading ? 'Cargando…' : 'No hay llegadas pendientes para hoy.'}</p>
                )}
              </div>
            </section>
          )}

          {isDesk && d?.low_stock && (
            <section>
              <h2 className="section-title">Insumos bajo el mínimo</h2>
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
  if (items.length === 0) return <p className="muted" style={{ padding: '12px 0' }}>Todo el inventario está sobre su mínimo.</p>
  return (
    <>
      <ul className="list-rows">
        {items.map((item) => (
          <li key={item.id}>
            <span className="identity">
              <strong>{item.name}</strong>
              <span className="num">{item.stock} de mínimo {item.min_stock} {item.unit}</span>
            </span>
            <Pill tone={item.stock === 0 ? 'negative' : 'warning'}>{item.stock === 0 ? 'Agotado' : 'Reponer'}</Pill>
          </li>
        ))}
      </ul>
      {count > items.length && <Link className="btn btn-sm" style={{ margin: '8px 0 12px' }} to="/inventario">Ver los {count}</Link>}
    </>
  )
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
