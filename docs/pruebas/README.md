# Pruebas

Hay tres niveles: unitarias y de integración con Pest, datos masivos con factories y carga/estrés con k6.

## Resultados al 2026-10-26 (local, Windows, PHP 8.2, SQLite en memoria)

| Suite | Comando | Resultado |
| --- | --- | --- |
| API · Pest (unit + feature) | `cd api && composer test` | **80 pruebas, 338 aserciones, todas pasan** |
| API · PHPStan nivel 5 (Larastan) | `cd api && vendor/bin/phpstan analyse` | **0 errores** |
| API · Pint | `cd api && vendor/bin/pint --test` | sin cambios pendientes |
| Web · Vitest + Testing Library | `cd web && npm test` | **12 pruebas, todas pasan** |
| Web · ESLint + TypeScript | `npm run lint && npm run typecheck` | 0 errores |
| Dependencias | `composer audit` · `npm audit` | **0 vulnerabilidades** (ver `docs/seguridad.md`) |

### Qué cubre cada prueba

- **Unit** (`api/tests/Unit`): cálculo del total de una reserva (noches × precio, redondeo), disponibilidad
  de habitaciones (cruces de fechas, el día de salida queda libre, canceladas no bloquean), alerta de stock mínimo.
- **Feature** (`api/tests/Feature`): registro y login separados, contraseña bcrypt, 401 sin token y con token
  vencido, refresh que revoca el anterior, verificación de correo firmada, 403 por rol (11 rutas pedidas a mano),
  422 por validación, 409 por doble reserva / stock / cochera, 429 en login, registro y API con `Retry-After`,
  400 por JSON mal formado, 404 con código del recurso, 500 sin trazas con `incident_id`, CORS, cabeceras de
  seguridad, paginación con máximo 50, auditoría, CRUD de todos los módulos y check-in → cochera → check-out.
- **Masiva** (`MassiveDataTest`): `MassiveDataSeeder` crea 50 habitaciones, 1000 clientes y 5000 reservas
  (≈0.2 s) y verifica que los listados paginados respondan en menos de 500 ms.
- **Frontend** (`web/src/test`): rutas protegidas por rol (403 aunque se escriba la URL), redirección al login,
  404, "En construcción", sesión vencida, login y registro separados, errores 401 y 422 mostrados en el formulario.

## Carga y estrés (k6)

Los scripts están en `tests/k6/` (ver su README). Cada corrida genera un HTML con gráficos en esta carpeta:

| Entrega | Usuarios virtuales | Archivo esperado | Meta | Estado |
| --- | --- | --- | --- | --- |
| 25% | 50 → 100 | `carga-25-100vu.html` | p95 < 500 ms, 0% errores | pendiente: requiere el servidor en AWS |
| 80% | 1000 / 3000 / 5000 | `carga-80-1000vu.html`, `-3000vu`, `-5000vu` | p95 < 800 ms, < 1% errores | pendiente |
| 100% | 10 000 / 25 000 / 50 000 | `estres-*.html`, `pico-*.html`, `resistencia-30min.html` | punto de quiebre y mejora | pendiente |

> Las corridas deben hacerse desde EC2 generadoras en us-east-1, nunca desde la laptop, y con los rate limits
> del entorno de pruebas elevados. Mínimo 3 corridas por entrega (carga normal, estrés y pico).

## Cuellos de botella (plantilla para la entrega del 100%)

| Síntoma (gráfico) | Causa | Corrección | Antes | Después |
| --- | --- | --- | --- | --- |
| | | | | |
