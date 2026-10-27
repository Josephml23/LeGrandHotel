/*
 * Escenario principal de LeGrandHotel: 70% lecturas, 20% login y 10% crear reserva.
 *
 * Perfiles (variable PROFILE):
 *   carga-25    50 → 100 usuarios virtuales (entrega 25%)       p95 < 500 ms, 0% errores
 *   carga-80    1000 / 3000 / 5000 (VUS=...) (entrega 80%)       p95 < 800 ms, < 1% errores
 *   estres      sube hasta encontrar el punto de quiebre (100%)
 *   pico        salto brusco de 0 a VUS en 10 s
 *   resistencia VUS constantes durante 30 min
 *
 * Reporte HTML con gráficos (va a docs/pruebas/):
 *   K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=docs/pruebas/carga-25-100vu.html \
 *     k6 run -e BASE_URL=https://api.<dominio>/api/v1 -e PROFILE=carga-25 tests/k6/reservas.js
 *
 * Importante: el entorno de pruebas debe subir los rate limits (RATE_LIMIT_API, RATE_LIMIT_LOGIN)
 * o los 429 contarán como errores. Para demostrar el 429 está tests/k6/rate-limit.js.
 */
import http from 'k6/http'
import { group, sleep } from 'k6'
import { Trend } from 'k6/metrics'
import { BASE_URL, JSON_HEADERS, PASSWORD, auth, createUsers, isoDate, ok } from './lib/config.js'

const PROFILE = __ENV.PROFILE || 'carga-25'
const VUS = Number(__ENV.VUS || 0)
const USERS = Number(__ENV.USERS || 50)

const profiles = {
  // Un escalón de VUS constantes (para comparar varias corridas cortas: 5, 10, 25, 50 VU…).
  escalon: {
    stages: [
      { duration: '10s', target: VUS || 10 },
      { duration: __ENV.DURATION || '45s', target: VUS || 10 },
      { duration: '5s', target: 0 },
    ],
    thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.01'] },
  },
  'carga-25': {
    stages: [
      { duration: '1m', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '30s', target: 0 },
    ],
    thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.001'] },
  },
  'carga-80': {
    stages: [
      { duration: '2m', target: VUS || 1000 },
      { duration: '5m', target: VUS || 1000 },
      { duration: '1m', target: 0 },
    ],
    thresholds: { http_req_duration: ['p(95)<800'], http_req_failed: ['rate<0.01'] },
  },
  estres: {
    stages: [
      { duration: '2m', target: 1000 },
      { duration: '3m', target: 5000 },
      { duration: '3m', target: 10000 },
      { duration: '3m', target: VUS || 25000 },
      { duration: '2m', target: 0 },
    ],
    thresholds: { http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '1m' }] },
  },
  pico: {
    stages: [
      { duration: '10s', target: VUS || 5000 },
      { duration: '1m', target: VUS || 5000 },
      { duration: '10s', target: 0 },
    ],
    thresholds: { http_req_failed: ['rate<0.05'] },
  },
  resistencia: {
    stages: [
      { duration: '2m', target: VUS || 1000 },
      { duration: '30m', target: VUS || 1000 },
      { duration: '1m', target: 0 },
    ],
    thresholds: { http_req_duration: ['p(95)<800'], http_req_failed: ['rate<0.01'] },
  },
}

if (!profiles[PROFILE]) throw new Error(`PROFILE desconocido: ${PROFILE}`)

export const options = {
  stages: profiles[PROFILE].stages,
  thresholds: {
    ...profiles[PROFILE].thresholds,
    'http_req_duration{tipo:lectura}': ['p(95)<800'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: { profile: PROFILE },
}

const reservaCreada = new Trend('reserva_creada_ms', true)

export function setup() {
  const health = http.get(`${BASE_URL}/health`)
  if (health.status !== 200) throw new Error(`La API no está sana antes de la prueba: ${health.status}`)
  return { tokens: createUsers(USERS) }
}

export default function ({ tokens }) {
  const token = tokens[(__VU - 1) % tokens.length]
  const dice = Math.random()

  if (dice < 0.7) {
    group('lecturas', () => {
      const from = isoDate(30 + (__ITER % 60))
      const to = isoDate(31 + (__ITER % 60) + 2)
      ok(http.get(`${BASE_URL}/rooms/available?from=${from}&to=${to}&per_page=15`, { ...auth(token), tags: { tipo: 'lectura', name: 'rooms/available' } }), 'disponibles')
      ok(http.get(`${BASE_URL}/reservations?per_page=15`, { ...auth(token), tags: { tipo: 'lectura', name: 'reservations' } }), 'mis reservas')
      ok(http.get(`${BASE_URL}/room-types`, { ...auth(token), tags: { tipo: 'lectura', name: 'room-types' } }), 'tipos')
    })
  } else if (dice < 0.9) {
    group('login', () => {
      const i = (__VU - 1) % tokens.length
      ok(http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email: `k6-${i}@carga.legrandhotel.test`, password: PASSWORD }), { headers: JSON_HEADERS, tags: { tipo: 'login' } }), 'login')
    })
  } else {
    group('crear reserva', () => {
      const offset = 100 + Math.floor(Math.random() * 300)
      const from = isoDate(offset)
      const to = isoDate(offset + 1)
      const rooms = http.get(`${BASE_URL}/rooms/available?from=${from}&to=${to}&per_page=50`, { ...auth(token), tags: { tipo: 'lectura', name: 'rooms/available' } })
      const list = rooms.json('data') || []
      if (list.length === 0) return
      const room = list[Math.floor(Math.random() * list.length)]
      const res = http.post(`${BASE_URL}/reservations`, JSON.stringify({ room_id: room.id, check_in: from, check_out: to }), {
        ...auth(token),
        tags: { tipo: 'escritura', name: 'reservations:create' },
        // 409 = otro usuario virtual tomó la habitación primero: comportamiento correcto, no error.
        responseCallback: http.expectedStatuses(201, 409),
      })
      reservaCreada.add(res.timings.duration)
    })
  }

  sleep(1 + Math.random())
}
