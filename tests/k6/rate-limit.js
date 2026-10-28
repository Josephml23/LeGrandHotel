/*
 * Demuestra la espera tras una contraseña incorrecta: el 1.er intento recibe 401 con retry_after = 30
 * y el 2.º (dentro de esos 30 s) recibe 429 LOGIN_LOCKED con Retry-After. La espera se duplica en cada fallo.
 * El throttle general del login (5 por minuto por IP + correo) sigue activo detrás.
 *   k6 run -e BASE_URL=http://localhost:8000/api/v1 tests/k6/rate-limit.js
 */
import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, JSON_HEADERS } from './lib/config.js'

export const options = { vus: 1, iterations: 1 }

export default function () {
  const body = JSON.stringify({ email: `limite-${Date.now()}@carga.legrandhotel.test`, password: 'incorrecta' })
  const params = { headers: JSON_HEADERS, responseCallback: http.expectedStatuses(401, 429) }

  const first = http.post(`${BASE_URL}/auth/login`, body, params)
  check(first, {
    '1.er intento → 401': (r) => r.status === 401,
    'avisa que debe esperar 30 s': (r) => r.json('error.details.retry_after') === 30,
  })

  const second = http.post(`${BASE_URL}/auth/login`, body, params)
  check(second, {
    '2.º intento → 429': (r) => r.status === 429,
    'trae Retry-After': (r) => !!r.headers['Retry-After'],
    'formato JSON único': (r) => r.json('error.code') === 'LOGIN_LOCKED',
  })

  console.log(`Estados recibidos: ${first.status}, ${second.status} (esperar ${second.headers['Retry-After']} s)`)
}
