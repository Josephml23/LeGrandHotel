# Seguridad implementada

Cada requisito de seguridad tiene una implementación concreta y una prueba que lo demuestra.

| Requisito | Implementación | Evidencia |
| --- | --- | --- |
| Cifrado de contraseñas | bcrypt (12 rondas) con el cast `hashed` del modelo `User` | `AuthTest` verifica `$2y$…`; captura de la tabla `users` |
| Variables de entorno | `.env` en `.gitignore`; `.env.example` sin secretos; en AWS, SSM Parameter Store | el repositorio no contiene claves |
| Rate limits | `AppServiceProvider`: login 5/min por IP+correo, registro 3/min por IP, API 60/min por usuario | `AuthTest`, `ApiBehaviourTest`, `tests/k6/rate-limit.js` (429 + `Retry-After`) |
| Registro y login diferenciados | Rutas, FormRequests y pantallas separadas; el registro crea rol Cliente | `AuthTest`, `forms.test.tsx` |
| Autenticación | Sanctum, tokens Bearer | sin token → 401 |
| Autorización y múltiples usuarios | Roles (Administrador, Recepcionista, Almacenero, Cliente) + middleware `role:` + `ReservationPolicy` | `AuthorizationTest`: recepcionista → `/staff` = 403 |
| Tokens expirados | `SANCTUM_EXPIRATION=60`; `/auth/refresh` emite uno nuevo y revoca el anterior; `sanctum:prune-expired` diario | token vencido → 401 → el frontend muestra "Sesión expirada" |
| Rutas protegidas contra acceso manual | Backend: middleware en todas las rutas (el rol se valida **antes** de buscar el modelo, así no se filtra si un id existe). Frontend: `ProtectedRoute` por rol | URL escrita a mano → pantalla 403 (`routes.test.tsx`) |
| Ingreso con cuenta de correo | Socialite (Google OAuth, stateless) + verificación de correo (`MustVerifyEmail`, enlace firmado). El cliente debe verificar antes de reservar | `AuthTest` (enlace firmado / sin firma → 403) |
| CORS | `config/cors.php`: `allowed_origins` solo `FRONTEND_URL` | `curl -H "Origin: https://otro.com"` no recibe `Access-Control-Allow-Origin` |
| Validación de entrada | FormRequest en cada endpoint de escritura; Eloquent con bindings evita inyección SQL; búsquedas `LIKE` escapadas | 422 en pruebas |
| Cabeceras de seguridad | `SecurityHeaders`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP, HSTS en producción; HTTPS obligatorio en el ALB | `ApiBehaviourTest` |
| Errores sin filtración | `ApiExceptionRenderer`: nunca HTML ni trazas; 500/503 con `incident_id` que coincide con el log | `ApiBehaviourTest` |
| Auditoría | Trait `Auditable` → tabla `audit_logs` (crear, editar, eliminar; sin contraseñas) | `ApiBehaviourTest`, pantalla Auditoría |
| Token de Google fuera de logs | El callback entrega el token en el fragmento `#token=` (no viaja al servidor) | revisión de código |
| Concurrencia en reservas | `lockForUpdate` sobre la habitación dentro de una transacción | 409 `ROOM_ALREADY_BOOKED` |
| **EXTRA** cifrar el código | Build de React ofuscado con `javascript-obfuscator` (plugin propio en `vite.config.ts`); backend en servidor privado sin acceso al código | `npm run build:plain` vs `npm run build`: el texto "No tienes acceso" aparece 1 vez en el bundle plano y 0 en el ofuscado |

## Auditoría de dependencias (2026-10-26)

| Herramienta | Hallazgo | Corrección |
| --- | --- | --- |
| `composer audit` | Sin vulnerabilidades | — |
| `npm audit` | `react-router` 6.x: open redirect (GHSA-wrjc-x8rr-h8h6, moderada) | Actualizado a `react-router-dom` 7.18 (compatible con React 18) |
| `npm audit` | `zod` < 4.6.6 vía `javascript-obfuscator → @vercel/blob` (GHSA-mrhx-c7xc-m3w5, alta, solo en build) | `overrides` en `web/package.json` fuerza `zod ^4.6.7` |
| Resultado | **0 vulnerabilidades** en ambos | |
| Semgrep (`p/php`, `p/owasp-top-ten`, `p/typescript`, `p/react`, `p/secrets`) | 17 acciones de GitHub con tags mutables | Fijadas por SHA de commit |
| Semgrep | Inyección de shell en `deploy.yml` (mensaje del commit dentro de `run:`) | Pasa por `env` y se serializa con `jq` |
| Semgrep | Repositorio ECR con tags mutables | `IMMUTABLE`; cada versión es el SHA y el rollback vuelve al SHA anterior vía SSM |
| Semgrep | Subred pública con IP pública para las EC2 | Aceptado y documentado: evita el NAT (~USD 32/mes); el SG solo permite tráfico del ALB; RDS y Redis en subred privada |
| Semgrep final | **0 hallazgos** | |

Antes de cada entrega: `composer audit`, `npm audit` y Semgrep (plugin `static-analysis` de Trail of Bits;
en CI con `semgrep scan --config p/php --config p/laravel ...`). Los hallazgos y su corrección van en esta tabla.
