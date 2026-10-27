import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { API_URL, getOne, api } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { Kpi, Pill, SearchInput, TitleRow, useDebounced } from '../components/ui'

interface Overview {
  app: { name: string; version: string; environment: string; debug: boolean; timezone: string; php: string; laravel: string; opcache: boolean }
  drivers: Record<string, string>
  security: { token_minutes: number; rate_limits_per_minute: Record<string, number>; cors_origins: string[]; pagination_max: number; google_login_configured: boolean }
  tables: Record<string, number>
  query_ms: number
}

interface HealthCheck { status: 'ok' | 'down'; latency_ms?: number }
interface Health { status: string; version: string; time: string; checks: Record<string, HealthCheck> }

interface RequestRow { time: string; request_id: string; user_id: number | null; method: string; route: string; status: number; duration_ms: number }
interface Requests {
  summary: {
    sampled: number; p50_ms: number; p95_ms: number; p99_ms: number
    status: Record<'2xx' | '4xx' | '5xx', number>
    slowest_routes: { route: string; count: number; p95_ms: number; errors: number }[]
  }
  requests: RequestRow[]
}

interface ErrorRow { time: string; level: string; message: string; incident_id: string | null; request_id: string | null; exception: string | null; file: string | null }
interface RouteRow { methods: string[]; uri: string; auth: boolean; roles: string[]; throttle: string | null; action: string }

type Tab = 'resumen' | 'peticiones' | 'errores' | 'rutas'

/**
 * Pregunta de la pantalla: ¿la API está sana y qué está fallando o tardando ahora?
 * Todo se lee de la propia API (sin entrar al servidor) y se refresca solo.
 */
export function DeveloperPage() {
  const [tab, setTab] = useState<Tab>('resumen')

  // /health se consulta "a mano" para ver su JSON incluso cuando responde 503.
  const health = useQuery({
    queryKey: ['dev', 'health'],
    queryFn: async () => (await api.get(`${API_URL}/health`, { validateStatus: () => true })).data.data as Health,
    refetchInterval: 15_000,
  })
  const requests = useQuery({ queryKey: ['dev', 'requests'], queryFn: () => getOne<Requests>('/dev/requests', { limit: 100 }), refetchInterval: 10_000 })

  const h = health.data
  const s = requests.data?.summary
  const down = h ? Object.entries(h.checks).filter(([, c]) => c.status !== 'ok').map(([k]) => k) : []
  const errorRate = s && s.sampled ? ((s.status['5xx'] / s.sampled) * 100).toFixed(1) : '0.0'

  const finding = !h
    ? 'Consultando el estado de la API…'
    : down.length
      ? `Atención: no responde ${down.join(' y ')}. La API devuelve 503 con motivo.`
      : s && s.status['5xx'] > 0
        ? `API sana, pero hubo ${s.status['5xx']} errores 5xx en las últimas ${s.sampled} peticiones.`
        : `API sana: p95 de ${s?.p95_ms ?? 0} ms en las últimas ${s?.sampled ?? 0} peticiones, sin errores 5xx.`

  return (
    <>
      <TitleRow title="Vista del programador" lede="Salud, configuración, peticiones, errores y rutas de la API. Se actualiza sola cada 10–15 s." finding={finding}>
        <button className="btn" onClick={() => { health.refetch(); requests.refetch() }}>Actualizar ahora</button>
      </TitleRow>

      <div className="kpis" style={{ marginBottom: 20 }}>
        <Kpi label="Estado" value={h ? (down.length ? 'Degradada' : 'Sana') : '—'} caption={h ? `v${h.version} · ${formatDateTime(h.time)}` : undefined} />
        <Kpi label="Latencia p95" value={s ? `${s.p95_ms} ms` : '—'} caption={s ? `p50 ${s.p50_ms} ms · p99 ${s.p99_ms} ms` : 'Meta del 25%: < 500 ms'} />
        <Kpi label="Errores 5xx" value={s ? `${errorRate}%` : '—'} caption={s ? `${s.status['5xx']} de ${s.sampled} peticiones` : undefined} />
        <Kpi label="Respuestas 4xx" value={s?.status['4xx'] ?? '—'} caption="Validación, permisos, rate limit" />
      </div>

      <div className="tabs" role="tablist" aria-label="Secciones del diagnóstico">
        {(['resumen', 'peticiones', 'errores', 'rutas'] as const).map((t) => (
          <button key={t} role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {{ resumen: 'Resumen', peticiones: 'Peticiones', errores: 'Errores', rutas: 'Rutas de la API' }[t]}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <Summary health={h} />}
      {tab === 'peticiones' && <RequestsTab data={requests.data} loading={requests.isLoading} />}
      {tab === 'errores' && <ErrorsTab />}
      {tab === 'rutas' && <RoutesTab />}
    </>
  )
}

function Summary({ health }: { health?: Health }) {
  const overview = useQuery({ queryKey: ['dev', 'overview'], queryFn: () => getOne<Overview>('/dev/overview') })
  const o = overview.data

  return (
    <div className="overview enter">
      <div className="stack">
        <section className="card">
          <h2 className="section-title">Servicios</h2>
          <ul className="list-rows">
            {health ? Object.entries(health.checks).map(([name, c]) => (
              <li key={name}>
                <span className="identity"><strong>{{ app: 'Aplicación', database: 'Base de datos', cache: 'Caché' }[name] ?? name}</strong>
                  <span className="num">{c.latency_ms !== undefined ? `${c.latency_ms} ms` : '—'}</span></span>
                <Pill tone={c.status === 'ok' ? 'positive' : 'negative'}>{c.status === 'ok' ? 'Responde' : 'Caído'}</Pill>
              </li>
            )) : <li className="muted">Consultando…</li>}
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">Registros por tabla</h2>
          {o ? (
            <table className="data">
              <thead><tr><th scope="col">Tabla</th><th className="right" scope="col">Registros</th></tr></thead>
              <tbody>
                {Object.entries(o.tables).map(([t, n]) => (
                  <tr key={t}><td className="mono">{t}</td><td className="right num">{n.toLocaleString('es-PE')}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Cargando…</p>}
          {o && <p className="muted small" style={{ marginTop: 8 }}>Conteo hecho en {o.query_ms} ms.</p>}
        </section>
      </div>

      <aside className="stack" aria-label="Configuración">
        <section>
          <h2 className="section-title">Aplicación</h2>
          <div className="card" style={{ padding: '4px 16px' }}>
            <Rows rows={o ? [
              ['Versión', o.app.version], ['Entorno', o.app.environment], ['Debug', o.app.debug ? 'Activado' : 'Desactivado'],
              ['PHP', o.app.php], ['Laravel', o.app.laravel], ['OPcache', o.app.opcache ? 'Activo' : 'Inactivo'], ['Zona horaria', o.app.timezone],
            ] : []} />
          </div>
        </section>
        <section>
          <h2 className="section-title">Drivers</h2>
          <div className="card" style={{ padding: '4px 16px' }}>
            <Rows rows={o ? Object.entries(o.drivers).map(([k, v]) => [{ database: 'Base de datos', cache: 'Caché', queue: 'Colas', log_channel: 'Logs', mail: 'Correo' }[k] ?? k, v]) : []} />
          </div>
        </section>
        <section>
          <h2 className="section-title">Seguridad</h2>
          <div className="card" style={{ padding: '4px 16px' }}>
            <Rows rows={o ? [
              ['Vida del token', `${o.security.token_minutes} min`],
              ['Login', `${o.security.rate_limits_per_minute.login}/min`],
              ['Registro', `${o.security.rate_limits_per_minute.register}/min`],
              ['API', `${o.security.rate_limits_per_minute.api}/min por usuario`],
              ['CORS', o.security.cors_origins.join(', ')],
              ['Máx. por página', String(o.security.pagination_max)],
              ['Login con Google', o.security.google_login_configured ? 'Configurado' : 'Faltan credenciales'],
            ] : []} />
          </div>
        </section>
      </aside>
    </div>
  )
}

function Rows({ rows }: { rows: (string | undefined)[][] }) {
  if (!rows.length) return <p className="muted" style={{ padding: '12px 0' }}>Cargando…</p>
  return (
    <ul className="list-rows">
      {rows.map(([k, v]) => (
        <li key={k}><span className="muted">{k}</span><span className="num" style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span></li>
      ))}
    </ul>
  )
}

const statusTone = (s: number) => (s >= 500 ? 'negative' : s >= 400 ? 'warning' : 'positive') as 'negative' | 'warning' | 'positive'

function RequestsTab({ data, loading }: { data?: Requests; loading: boolean }) {
  const [filter, setFilter] = useState<'' | '2xx' | '4xx' | '5xx'>('')
  const rows = (data?.requests ?? []).filter((r) => !filter || Math.floor(r.status / 100) === Number(filter[0]))

  return (
    <div className="stack enter">
      <section className="card">
        <h2 className="section-title">Rutas más lentas (p95)</h2>
        {data?.summary.slowest_routes.length ? (
          <table className="data">
            <thead><tr><th scope="col">Ruta</th><th className="right" scope="col">Peticiones</th><th className="right" scope="col">p95</th><th className="right" scope="col">5xx</th></tr></thead>
            <tbody>
              {data.summary.slowest_routes.map((r) => (
                <tr key={r.route}>
                  <td className="mono">{r.route}</td>
                  <td className="right num">{r.count}</td>
                  <td className="right num">{r.p95_ms} ms</td>
                  <td className="right num">{r.errors || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">{loading ? 'Cargando…' : 'Aún no hay peticiones registradas en el log.'}</p>}
      </section>

      <section>
        <div className="toolbar">
          <h2 className="section-title" style={{ margin: 0 }}>Últimas peticiones</h2>
          <div className="filters" role="group" aria-label="Filtrar por código">
            {(['', '2xx', '4xx', '5xx'] as const).map((f) => (
              <button key={f} className="btn btn-sm" style={{ background: filter === f ? 'var(--active)' : undefined }} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f || 'Todas'}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th scope="col">Hora</th><th scope="col">Método</th><th scope="col">Ruta</th><th scope="col">Código</th><th className="right" scope="col">Duración</th><th className="hide-sm" scope="col">Usuario</th></tr></thead>
            <tbody>
              {rows.slice(0, 60).map((r) => (
                <tr key={r.request_id + r.time}>
                  <td className="num">{formatDateTime(r.time)}</td>
                  <td className="mono">{r.method}</td>
                  <td className="mono">/{r.route}</td>
                  <td><Pill tone={statusTone(r.status)}>{r.status}</Pill></td>
                  <td className="right num">{r.duration_ms} ms</td>
                  <td className="hide-sm num">{r.user_id ?? '—'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="muted">Sin peticiones con este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function ErrorsTab() {
  const [incident, setIncident] = useState('')
  const debounced = useDebounced(incident.trim())
  const errors = useQuery({ queryKey: ['dev', 'errors', debounced], queryFn: () => getOne<ErrorRow[]>('/dev/errors', { incident: debounced || undefined, limit: 50 }) })

  return (
    <div className="stack enter">
      <div className="toolbar">
        <SearchInput value={incident} onChange={setIncident} label="Código de incidente (lo ve el usuario en la pantalla 500)" />
        <span className="muted num">{errors.data?.length ?? 0} errores</span>
      </div>
      {errors.data?.length ? (
        <ul className="list-rows card" style={{ padding: '4px 16px' }}>
          {errors.data.map((e, i) => (
            <li key={`${e.time}-${i}`} style={{ alignItems: 'flex-start', padding: '10px 0' }}>
              <span className="identity" style={{ minWidth: 0 }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{e.message}</strong>
                <span>{e.exception ?? e.level} · {e.file ?? 'sin archivo'} · {formatDateTime(e.time)}</span>
              </span>
              {e.incident_id && <span className="mono">{e.incident_id}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="muted">{errors.isLoading ? 'Cargando…' : debounced ? 'No hay errores con ese código.' : 'No hay errores registrados. Buena señal.'}</p>}
    </div>
  )
}

function RoutesTab() {
  const routes = useQuery({ queryKey: ['dev', 'routes'], queryFn: () => getOne<RouteRow[]>('/dev/routes') })
  const [search, setSearch] = useState('')
  const rows = useMemo(
    () => (routes.data ?? []).filter((r) => !search || `${r.methods.join(' ')} ${r.uri} ${r.action}`.toLowerCase().includes(search.toLowerCase())),
    [routes.data, search],
  )

  return (
    <div className="enter">
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} label="Buscar ruta, método o controlador" />
        <span className="muted num">{rows.length} rutas</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th scope="col">Método</th><th scope="col">Ruta</th><th scope="col">Acceso</th><th className="hide-sm" scope="col">Límite</th><th className="hide-sm" scope="col">Controlador</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.methods.join() + r.uri}>
                <td className="mono">{r.methods.join(', ')}</td>
                <td className="mono">{r.uri}</td>
                <td>{!r.auth ? <Pill tone="neutral">Público</Pill> : r.roles.length ? r.roles.join(', ') : 'Autenticado'}</td>
                <td className="hide-sm mono">{r.throttle?.replace('throttle:', '') ?? 'api'}</td>
                <td className="hide-sm mono small">{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
