/*
 * Inicio de sesión y creación de reservas, un usuario por usuario virtual (máximo 1 minuto).
 *
 * Cada usuario virtual usa su propia cuenta (k6-0, k6-1, …) y hace lo que haría un recepcionista:
 *   1. inicia sesión UNA sola vez (como en la vida real: una vez por turno, no en cada clic);
 *   2. con ese token, registra reservas, con una pausa entre una y otra.
 *
 * La prueba dura 60 s en total: 15 s subiendo, 40 s sostenidos y 5 s bajando.
 *
 *   k6 run -e BASE_URL=http://localhost:8000/api/v1 -e VUS=1000 tests/k6/inicio-reserva.js
 *
 * Antes: las cuentas de carga deben existir (una por usuario virtual) y tiene que haber clientes:
 *   docker exec -e K6_USERS=1000 legrandhotel-app-1 php artisan db:seed --class=LoadTestUsersSeeder --force
 *   docker exec legrandhotel-app-1 php artisan db:seed --class=MassiveDataSeeder --force
 * Y los rate limits altos, o los 429 contarán como errores.
 */
import http from 'k6/http'
import { fail, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { BASE_URL, JSON_HEADERS, PASSWORD, auth, isoDate, ok } from './lib/config.js'

const VUS = Number(__ENV.VUS || 1000)
/** Segundos que el recepcionista tarda entre una reserva y la siguiente (10 s es lo realista). */
const PAUSA = Number(__ENV.PAUSA || 10)

const loginMs = new Trend('login_ms', true)
const reservaMs = new Trend('reserva_ms', true)
const creadas = new Counter('reservas_creadas')
const ocupadas = new Counter('reservas_habitacion_ocupada')
const loginOk = new Rate('login_correcto')

export const options = {
  stages: [
    { duration: '15s', target: VUS },
    { duration: '40s', target: VUS },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    'login_ms': ['p(95)<800'],
    'reserva_ms': ['p(95)<800'],
    'login_correcto': ['rate>0.99'],
    'http_req_failed': ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: { escenario: 'inicio-reserva' },
}

export function setup() {
  const health = http.get(`${BASE_URL}/health`)
  if (health.status !== 200) fail(`La API no está sana antes de la prueba: ${health.status}`)

  // Una sola cuenta para leer los catálogos; cada usuario virtual inicia su propia sesión después.
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: 'k6-0@carga.legrandhotel.test', password: PASSWORD }), { headers: JSON_HEADERS })
  if (res.status !== 200) fail(`No se pudo iniciar sesión con k6-0 (${res.status}). Corre LoadTestUsersSeeder con K6_USERS >= ${VUS}.`)
  const token = res.json('data.token')

  const rooms = http.get(`${BASE_URL}/rooms?per_page=50`, auth(token)).json('data') || []
  const clients = http.get(`${BASE_URL}/clients?per_page=50`, auth(token)).json('data') || []
  if (rooms.length === 0 || clients.length === 0) fail('Faltan habitaciones o clientes: corre MassiveDataSeeder.')

  return { roomIds: rooms.map((r) => r.id), clientIds: clients.map((c) => c.id) }
}

// Cada usuario virtual tiene su propia copia de estas variables: el token sobrevive entre iteraciones.
let token = null
let email = null

export default function ({ roomIds, clientIds }) {
  // 1. Inicio de sesión: solo en la primera iteración de este usuario.
  if (token === null) {
    email = `k6-${(__VU - 1) % VUS}@carga.legrandhotel.test`
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password: PASSWORD }), {
      headers: JSON_HEADERS,
      tags: { tipo: 'login', name: 'auth/login' },
    })
    loginMs.add(res.timings.duration)
    loginOk.add(res.status === 200)
    if (res.status !== 200) {
      sleep(PAUSA)
      return // sin sesión no puede reservar; se reintenta en la siguiente iteración
    }
    token = res.json('data.token')
  }

  // 2. Registra una reserva a nombre de un huésped, en una habitación y fechas al azar.
  const dia = 30 + Math.floor(Math.random() * 365)
  const payload = {
    client_id: clientIds[Math.floor(Math.random() * clientIds.length)],
    room_id: roomIds[Math.floor(Math.random() * roomIds.length)],
    check_in: isoDate(dia),
    check_out: isoDate(dia + 1),
    guests: 1,
  }
  const res = http.post(`${BASE_URL}/reservations`, JSON.stringify(payload), {
    ...auth(token),
    tags: { tipo: 'escritura', name: 'reservations:create' },
    // 409 = otro usuario tomó esa habitación primero: es la respuesta correcta, no un error.
    responseCallback: http.expectedStatuses(201, 409),
  })
  reservaMs.add(res.timings.duration)
  if (res.status === 201) creadas.add(1)
  else if (res.status === 409) ocupadas.add(1)
  else ok(res, 'reserva')

  sleep(PAUSA * (0.75 + Math.random() * 0.5))
}
