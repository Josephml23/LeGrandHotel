/*
 * Smoke test previo a cada despliegue (y verificación posterior en el pipeline):
 * 20 usuarios virtuales durante 1 minuto. Si falla, el despliegue se revierte.
 *   k6 run -e BASE_URL=https://api.<dominio>/api/v1 tests/k6/smoke.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, JSON_HEADERS } from './lib/config.js'

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.99'],
  },
}

export default function () {
  const health = http.get(`${BASE_URL}/health`)
  check(health, {
    'health 200': (r) => r.status === 200,
    'BD ok': (r) => r.json('data.checks.database.status') === 'ok',
    'caché ok': (r) => r.json('data.checks.cache.status') === 'ok',
  })

  // Rutas protegidas responden 401 en JSON (no HTML, no 500).
  const anon = http.get(`${BASE_URL}/reservations`, { headers: JSON_HEADERS, responseCallback: http.expectedStatuses(401) })
  check(anon, { 'sin token → 401 JSON': (r) => r.status === 401 && r.json('error.code') === 'UNAUTHENTICATED' })

  sleep(1)
}
