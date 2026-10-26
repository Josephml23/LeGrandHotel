/*
 * Demuestra el rate limit del login (5 por minuto): el 6.º intento recibe 429 con Retry-After.
 *   k6 run -e BASE_URL=http://localhost:8000/api/v1 tests/k6/rate-limit.js
 */
import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, JSON_HEADERS } from './lib/config.js'

export const options = { vus: 1, iterations: 1 }

export default function () {
  const body = JSON.stringify({ email: `limite-${Date.now()}@carga.legrandhotel.test`, password: 'incorrecta' })
  const statuses = []
  for (let i = 0; i < 6; i++) {
    const res = http.post(`${BASE_URL}/auth/login`, body, { headers: JSON_HEADERS, responseCallback: http.expectedStatuses(401, 429) })
    statuses.push(res.status)
    if (i === 5) {
      check(res, {
        '6.º intento → 429': (r) => r.status === 429,
        'trae Retry-After': (r) => !!r.headers['Retry-After'],
        'formato JSON único': (r) => r.json('error.code') === 'TOO_MANY_REQUESTS',
      })
    }
  }
  console.log(`Estados recibidos: ${statuses.join(', ')}`)
}
