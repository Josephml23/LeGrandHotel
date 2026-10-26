// Configuración compartida de los escenarios k6 de LeGrandHotel.
import http from 'k6/http'
import { check, fail } from 'k6'

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')

// Cuentas de prueba verificadas creadas con: php artisan db:seed --class=LoadTestUsersSeeder
// (usa una BD de pruebas, nunca producción con datos reales).
export const PASSWORD = __ENV.K6_PASSWORD || 'CargaK6-2026'

export const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' }

export function auth(token) {
  return { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } }
}

/** Inicia sesión con los N clientes de carga (LoadTestUsersSeeder) y devuelve sus tokens. */
export function createUsers(count) {
  const tokens = []
  for (let i = 0; i < count; i++) {
    const email = `k6-${i}@carga.legrandhotel.test`
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password: PASSWORD }), { headers: JSON_HEADERS })
    if (res.status !== 200) {
      fail(`No se pudo iniciar sesión con ${email} (${res.status}). Corre LoadTestUsersSeeder con K6_USERS >= ${count} y sube RATE_LIMIT_LOGIN.`)
    }
    tokens.push(res.json('data.token'))
  }
  return tokens
}

export function isoDate(daysFromToday) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

export function ok(res, name) {
  return check(res, { [`${name}: 2xx`]: (r) => r.status >= 200 && r.status < 300 })
}
