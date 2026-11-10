/*
 * 50 clientes del portal registran 1000 reservas: ¿cuánto tarda y cumple los tiempos?
 *
 * Cada usuario virtual es un cliente con su sesión ya abierta (LoadTestClientsSeeder), porque los clientes
 * entran solo con Google y k6 no puede iniciar sesión en Google. Cada iteración es una reserva completa:
 * busca los tipos libres para sus fechas y reserva uno. El trabajo total está fijo: 1000 reservas entre los 50.
 *
 * Preparar (desde api/):   K6_CLIENTS=50 php artisan db:seed --class=LoadTestClientsSeeder --force
 * Correr (desde la raíz):  k6 run -e BASE_URL=http://localhost:8000/api/v1 tests/k6/clientes-1000-reservas.js
 * Limpiar (desde api/):    php artisan k6:limpiar
 *
 * CLIENTES (50) y RESERVAS (1000) se pueden cambiar con -e. PAUSA son los segundos entre una reserva y la
 * siguiente (0 por defecto: mide cuánto tarda el sistema, no cuánto piensa el cliente).
 */
import http from 'k6/http'
import { fail, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { BASE_URL, auth, isoDate, ok } from './lib/config.js'

const CLIENTES = Number(__ENV.CLIENTES || 50)
const RESERVAS = Number(__ENV.RESERVAS || 1000)
const PAUSA = Number(__ENV.PAUSA || 0)
const TOKENS = JSON.parse(open('./.tokens-clientes.json'))

const buscarMs = new Trend('buscar_ms', true)
const reservaMs = new Trend('reserva_ms', true)
const creadas = new Counter('reservas_creadas')
const sinCupo = new Counter('reservas_sin_cupo')

export const options = {
  scenarios: {
    // Trabajo fijo: entre los CLIENTES se reparten las RESERVAS y la prueba termina cuando se completan.
    reservas: {
      executor: 'shared-iterations',
      vus: CLIENTES,
      iterations: RESERVAS,
      maxDuration: __ENV.MAX_DURATION || '3m',
    },
  },
  thresholds: {
    'buscar_ms': ['p(95)<800'],
    'reserva_ms': ['p(95)<800'],
    'http_req_failed': ['rate<0.01'],
    // Casi todas deben quedar registradas; un 409 ocasional es correcto (se agotó ese tipo en esas fechas).
    'reservas_creadas': [`count>=${Math.round(RESERVAS * 0.95)}`],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: { escenario: 'clientes-1000-reservas' },
}

export function setup() {
  const health = http.get(`${BASE_URL}/health`)
  if (health.status !== 200) fail(`La API no está sana antes de la prueba: ${health.status}`)
  if (TOKENS.length < CLIENTES) fail(`Hay ${TOKENS.length} clientes de prueba y hacen falta ${CLIENTES}: corre LoadTestClientsSeeder con K6_CLIENTS=${CLIENTES}.`)
  if (http.get(`${BASE_URL}/auth/me`, auth(TOKENS[0])).status !== 200) {
    fail('Los tokens de clientes ya no sirven: vuelve a correr LoadTestClientsSeeder.')
  }
}

export default function () {
  const token = TOKENS[(__VU - 1) % TOKENS.length]

  // Fechas repartidas en un año para que casi siempre haya cupo (70 habitaciones × 365 noches).
  const dia = 30 + Math.floor(Math.random() * 365)
  const from = isoDate(dia)
  const to = isoDate(dia + 1)

  const tipos = http.get(`${BASE_URL}/portal/room-types?from=${from}&to=${to}&guests=1`, {
    ...auth(token),
    tags: { tipo: 'busqueda', name: 'portal/room-types' },
  })
  buscarMs.add(tipos.timings.duration)
  if (!ok(tipos, 'buscar')) return

  const libres = (tipos.json('data') || []).filter((t) => t.available_rooms > 0)
  if (libres.length === 0) {
    sinCupo.add(1)
    return
  }

  const tipo = libres[Math.floor(Math.random() * libres.length)]
  const res = http.post(`${BASE_URL}/portal/reservations`, JSON.stringify({ room_type_id: tipo.id, check_in: from, check_out: to, guests: 1 }), {
    ...auth(token),
    tags: { tipo: 'escritura', name: 'portal/reservations:create' },
    // 409 = otro cliente tomó la última habitación de ese tipo: es la respuesta correcta, no un error.
    responseCallback: http.expectedStatuses(201, 409),
  })
  reservaMs.add(res.timings.duration)
  if (res.status === 201) creadas.add(1)
  else if (res.status === 409) sinCupo.add(1)
  else ok(res, 'reservar')

  if (PAUSA > 0) sleep(PAUSA * (0.75 + Math.random() * 0.5))
}
