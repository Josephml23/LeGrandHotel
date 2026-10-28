import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { API_URL, getOne, api } from '../lib/api'
import { formatDateTime, formatNumber } from '../lib/format'
import { t } from '../lib/i18n'
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
    ? t('Consultando el estado de la API…')
    : down.length
      ? t('Atención: no responde {services}. La API devuelve 503 con motivo.', { services: down.join(' · ') })
      : s && s.status['5xx'] > 0
        ? t('API sana, pero hubo {n} errores 5xx en las últimas {total} peticiones.', { n: s.status['5xx'], total: s.sampled })
        : t('API sana: p95 de {ms} ms en las últimas {total} peticiones, sin errores 5xx.', { ms: s?.p95_ms ?? 0, total: s?.sampled ?? 0 })

  return (
    <>
      <TitleRow title={t('Vista del programador')} lede={t('Salud, configuración, peticiones, errores y rutas de la API. Se actualiza sola cada 10–15 s.')} finding={finding}>
        <button className="btn" onClick={() => { health.refetch(); requests.refetch() }}>{t('Actualizar ahora')}</button>
      </TitleRow>

      <div className="kpis" style={{ marginBottom: 20 }}>
        <Kpi label={t('Estado')} value={h ? (down.length ? t('Degradada') : t('Sana')) : '—'} caption={h ? `v${h.version} · ${formatDateTime(h.time)}` : undefined} />
        <Kpi label={t('Latencia p95')} value={s ? `${s.p95_ms} ms` : '—'} caption={s ? `p50 ${s.p50_ms} ms · p99 ${s.p99_ms} ms` : t('Meta del 25%: < 500 ms')} />
        <Kpi label={t('Errores 5xx')} value={s ? `${errorRate}%` : '—'} caption={s ? t('{n} de {total} peticiones', { n: s.status['5xx'], total: s.sampled }) : undefined} />
        <Kpi label={t('Respuestas 4xx')} value={s?.status['4xx'] ?? '—'} caption={t('Validación, permisos, rate limit')} />
      </div>

      <div className="tabs" role="tablist" aria-label={t('Secciones del diagnóstico')}>
        {(['resumen', 'peticiones', 'errores', 'rutas'] as const).map((key) => (
          <button key={key} role="tab" className="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {t({ resumen: 'Resumen', peticiones: t('Peticiones'), errores: 'Errores', rutas: 'Rutas de la API' }[key])}
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
          <h2 className="section-title">{t('Servicios')}</h2>
          <ul className="list-rows">
            {health ? Object.entries(health.checks).map(([name, c]) => (
              <li key={name}>
                <span className="identity"><strong>{t({ app: t('Aplicación'), database: 'Base de datos', cache: 'Caché' }[name] ?? name)}</strong>
                  <span className="num">{c.latency_ms !== undefined ? `${c.latency_ms} ms` : '—'}</span></span>
                <Pill tone={c.status === 'ok' ? 'positive' : 'negative'}>{c.status === 'ok' ? t('Responde') : t('Caído')}</Pill>
              </li>
            )) : <li className="muted">{t('Consultando…')}</li>}
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">{t('Registros por tabla')}</h2>
          {o ? (
            <table className="data">
              <thead><tr><th scope="col">{t('Tabla')}</th><th className="right" scope="col">{t('Registros')}</th></tr></thead>
              <tbody>
                {Object.entries(o.tables).map(([table, n]) => (
                  <tr key={table}><td className="mono">{table}</td><td className="right num">{formatNumber(n)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">{t('Cargando…')}</p>}
          {o && <p className="muted small" style={{ marginTop: 8 }}>{t('Conteo hecho en {ms} ms.', { ms: o.query_ms })}</p>}
        </section>
      </div>

      <aside className="stack" aria-label={t('Configuración')}>
        <section>
          <h2 className="section-title">{t('Aplicación')}</h2>
          <div className="card" style={{ padding: '4px 16px' }}>
            <Rows rows={o ? [
              [t('Versión'), o.app.version], [t('Entorno'), o.app.environment], ['Debug', o.app.debug ? t('Activado') : t('Desactivado')],
              ['PHP', o.app.php], ['Laravel', o.app.laravel], ['OPcache', o.app.opcache ? t('Activo') : t('Inactivo')], [t('Zona horaria'), o.app.timezone],
            ] : []} />
          </div>
        </section>
        <section>
          <h2 className="section-title">{t('Drivers')}</h2>
          <div className="card" style={{ padding: '4px 16px' }}>
            <Rows rows={o ? Object.entries(o.drivers).map(([k, v]) => [t({ database: 'Base de datos', cache: 'Caché', queue: 'Colas', log_channel: 'Logs', mail: 'Correo' }[k] ?? k), v]) : []} />
          </div>
        </section>
        <section>
          <h2 className="section-title">{t('Seguridad')}</h2>
          <div className="card" style={{ padding: '4px 16px' }}>
            <Rows rows={o ? [
              [t('Vida del token'), `${o.security.token_minutes} min`],
              ['Login', `${o.security.rate_limits_per_minute.login}/min`],
              [t('Espera tras clave incorrecta'), t('30 s, se duplica en cada fallo (máx. 15 min)')],
              [t('Registro'), `${o.security.rate_limits_per_minute.register}/min`],
              ['API', t('{n}/min por usuario', { n: o.security.rate_limits_per_minute.api })],
              ['CORS', o.security.cors_origins.join(', ')],
              [t('Máx. por página'), String(o.security.pagination_max)],
              [t('Login con Google'), o.security.google_login_configured ? t('Configurado') : t('Faltan credenciales')],
            ] : []} />
          </div>
        </section>
      </aside>
    </div>
  )
}

function Rows({ rows }: { rows: (string | undefined)[][] }) {
  if (!rows.length) return <p className="muted" style={{ padding: '12px 0' }}>{t('Cargando…')}</p>
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
        <h2 className="section-title">{t('Rutas más lentas (p95)')}</h2>
        {data?.summary.slowest_routes.length ? (
          <table className="data">
            <thead><tr><th scope="col">{t('Ruta')}</th><th className="right" scope="col">{t('Peticiones')}</th><th className="right" scope="col">p95</th><th className="right" scope="col">5xx</th></tr></thead>
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
        ) : <p className="muted">{loading ? t('Cargando…') : t('Aún no hay peticiones registradas en el log.')}</p>}
      </section>

      <section>
        <div className="toolbar">
          <h2 className="section-title" style={{ margin: 0 }}>{t('Últimas peticiones')}</h2>
          <div className="filters" role="group" aria-label={t('Filtrar por código')}>
            {(['', '2xx', '4xx', '5xx'] as const).map((f) => (
              <button key={f} className="btn btn-sm" style={{ background: filter === f ? 'var(--active)' : undefined }} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f || t('Todas')}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th scope="col">{t('Hora')}</th><th scope="col">{t('Método')}</th><th scope="col">{t('Ruta')}</th><th scope="col">{t('Código')}</th><th className="right" scope="col">{t('Duración')}</th><th className="hide-sm" scope="col">{t('Usuario')}</th></tr></thead>
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
              {!rows.length && <tr><td colSpan={6} className="muted">{t('Sin peticiones con este filtro.')}</td></tr>}
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
        <SearchInput value={incident} onChange={setIncident} label={t('Código de incidente (lo ve el usuario en la pantalla 500)')} />
        <span className="muted num">{t('{n} errores', { n: errors.data?.length ?? 0 })}</span>
      </div>
      {errors.data?.length ? (
        <ul className="list-rows card" style={{ padding: '4px 16px' }}>
          {errors.data.map((e, i) => (
            <li key={`${e.time}-${i}`} style={{ alignItems: 'flex-start', padding: '10px 0' }}>
              <span className="identity" style={{ minWidth: 0 }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{e.message}</strong>
                <span>{e.exception ?? e.level} · {e.file ?? t('sin archivo')} · {formatDateTime(e.time)}</span>
              </span>
              {e.incident_id && <span className="mono">{e.incident_id}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="muted">{errors.isLoading ? t('Cargando…') : debounced ? t('No hay errores con ese código.') : t('No hay errores registrados. Buena señal.')}</p>}
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
        <SearchInput value={search} onChange={setSearch} label={t('Buscar ruta, método o controlador')} />
        <span className="muted num">{t('{n} rutas', { n: rows.length })}</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th scope="col">{t('Método')}</th><th scope="col">{t('Ruta')}</th><th scope="col">{t('Acceso')}</th><th className="hide-sm" scope="col">{t('Límite')}</th><th className="hide-sm" scope="col">{t('Controlador')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.methods.join() + r.uri}>
                <td className="mono">{r.methods.join(', ')}</td>
                <td className="mono">{r.uri}</td>
                <td>{!r.auth ? <Pill tone="neutral">{t('Público')}</Pill> : r.roles.length ? r.roles.join(', ') : t('Autenticado')}</td>
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
