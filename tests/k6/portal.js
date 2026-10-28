/*
 * Escenario de clientes (portal de reservas en línea): 60% buscan habitaciones libres, 25% revisan sus reservas
 * y 15% reservan. Cada usuario virtual es un cliente de prueba con su sesión ya abierta (LoadTestClientsSeeder),
 * porque los clientes entran solo con Google y k6 no puede iniciar sesión en Google.
 *
 * Preparar (desde api/):   $env:K6_CLIENTS="50"; php artisan db:seed --class=LoadTestClientsSeeder
 * Correr (desde la raíz):  k6 run -e BASE_URL=http://127.0.0.1:8000/api/v1 -e VUS=100 tests/k6/portal.js
 * Limpiar (desde api/):    php artisan k6:limpiar
 *
 * Mismo perfil que el escalón de reservas.js: sube en 10 s hasta VUS, se mantiene DURATION (45 s) y baja en 5 s.
 * Si hay más usuarios virtuales que clientes de prueba, comparten la sesión (VU 51 usa la del cliente 0, etc.).
 */
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend } from 'k6/metrics'
import { BASE_URL, auth, isoDate, ok } from './lib/config.js'

const VUS = Number(__ENV.VUS || 10)
const TOKENS = JSON.parse(open('./.tokens-clientes.json'))

export const options = {
  stages: [
    { duration: '10s', target: VUS },
    { duration: __ENV.DURATION || '45s', target: VUS },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{tipo:busqueda}': ['p(95)<800'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: { escenario: 'portal-clientes' },
}

const reservaCliente = new Trend('reserva_cliente_ms', true)

export function setup() {
  const health = http.get(`${BASE_URL}/health`)
  if (health.status !== 200) throw new Error(`La API no está sana antes de la prueba: ${health.status}`)
  if (TOKENS.length === 0) throw new Error('No hay clientes de prueba: corre LoadTestClientsSeeder.')
  const me = http.get(`${BASE_URL}/auth/me`, auth(TOKENS[0]))
  if (me.status !== 200) throw new Error(`Los tokens de clientes no sirven (${me.status}): vuelve a correr LoadTestClientsSeeder.`)
}

export default function () {
  const token = TOKENS[(__VU - 1) % TOKENS.length]
  const dice = Math.random()
  const offset = 30 + Math.floor(Math.random() * 300)
  const from = isoDate(offset)
  const to = isoDate(offset + 1 + Math.floor(Math.random() * 3))

  if (dice < 0.6) {
    group('buscar habitaciones', () => {
      ok(http.get(`${BASE_URL}/portal/room-types?from=${from}&to=${to}&guests=2`, { ...auth(token), tags: { tipo: 'busqueda', name: 'portal/room-types' } }), 'buscar')
    })
  } else if (dice < 0.85) {
    group('mis reservas', () => {
      ok(http.get(`${BASE_URL}/portal/reservations`, { ...auth(token), tags: { tipo: 'lectura', name: 'portal/reservations' } }), 'mis reservas')
    })
  } else {
    group('reservar', () => {
      const tipos = http.get(`${BASE_URL}/portal/room-types?from=${from}&to=${to}&guests=1`, { ...auth(token), tags: { tipo: 'busqueda', name: 'portal/room-types' } })
      const libres = (tipos.json('data') || []).filter((t) => t.available_rooms > 0)
      if (libres.length === 0) return
      const tipo = libres[Math.floor(Math.random() * libres.length)]
      const res = http.post(`${BASE_URL}/portal/reservations`, JSON.stringify({ room_type_id: tipo.id, check_in: from, check_out: to, guests: 1 }), {
        ...auth(token),
        tags: { tipo: 'escritura', name: 'portal/reservations:create' },
        // 409 = no quedaban habitaciones de ese tipo (otro cliente reservó primero): es correcto, no un error.
        responseCallback: http.expectedStatuses(201, 409),
      })
      check(res, { 'reservar: 201 o 409': (r) => r.status === 201 || r.status === 409 })
      reservaCliente.add(res.timings.duration)
    })
  }

  sleep(1 + Math.random() * 2)
}
