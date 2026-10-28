# Pruebas de carga y estrés (k6)

| Script | Para qué | Entrega |
| --- | --- | --- |
| `smoke.js` | 20 VU · 1 min antes y después de cada despliegue | todas |
| `rate-limit.js` | Demuestra el 429 del login (5/min) | 25% / 80% |
| `reservas.js` `PROFILE=carga-25` | 50 → 100 VU, p95 < 500 ms, 0% errores | 25% |
| `reservas.js` `PROFILE=carga-80 VUS=1000/3000/5000` | carga a 1000, 3000 y 5000 VU | 80% |
| `reservas.js` `PROFILE=estres / pico / resistencia` | punto de quiebre, picos y 30 min | 100% |
| `portal.js` `VUS=100` | **Clientes** en el portal: 60% buscan habitaciones, 25% ven sus reservas, 15% reservan | extra |

Escenario (recepción): 70% lecturas (habitaciones disponibles, reservas, tipos), 20% login y 10% crear reserva.
Los usuarios virtuales son recepcionistas de prueba (`LoadTestUsersSeeder`) y reservan a nombre de huéspedes de `MassiveDataSeeder`.
Los `thresholds` hacen que la corrida falle sola si no se cumple la meta.

Escenario de clientes (`portal.js`): los clientes entran solo con Google y k6 no puede iniciar sesión en Google, así que
`LoadTestClientsSeeder` crea clientes de prueba con DNI y teléfono y les abre la sesión (token de 24 h en
`tests/k6/.tokens-clientes.json`, fuera de git). Si hay más usuarios virtuales que clientes, comparten la sesión.

```powershell
cd api; $env:K6_CLIENTS="50"; php artisan db:seed --class=LoadTestClientsSeeder; cd ..
k6 run -e BASE_URL=http://127.0.0.1:8000/api/v1 -e VUS=100 tests/k6/portal.js
cd api; php artisan k6:limpiar          # borra cuentas de carga (recepcionistas y clientes) y sus reservas
php artisan k6:limpiar --masivos         # además, los huéspedes de MassiveDataSeeder y sus reservas
```

## Cómo correrlas

1. **Nunca desde la laptop**: desde una EC2 generadora en `us-east-1` (para 10 000+ VU, 3–5 generadoras que se apagan al terminar).
2. En el entorno de pruebas sube los límites para que los 429 no cuenten como errores:
   `RATE_LIMIT_API=100000 RATE_LIMIT_LOGIN=100000 RATE_LIMIT_REGISTER=100000`.
3. Genera el reporte HTML con gráficos directo en `docs/pruebas/`:

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=docs/pruebas/carga-25-100vu.html \
  k6 run -e BASE_URL=https://api.<dominio>/api/v1 -e PROFILE=carga-25 tests/k6/reservas.js

K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=docs/pruebas/carga-80-3000vu.html \
  k6 run -e BASE_URL=https://api.<dominio>/api/v1 -e PROFILE=carga-80 -e VUS=3000 -e USERS=500 tests/k6/reservas.js
```

Mínimo 3 corridas por entrega (carga normal, estrés y pico), cada una con su HTML en `docs/pruebas/`.
