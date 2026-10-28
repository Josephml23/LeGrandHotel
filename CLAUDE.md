# LeGrandHotel — guía para Claude Code

Monorepo: `api/` (Laravel 12, Pest), `web/` (React 18 + TS + Vite), `infra/` (Terraform, Docker), `tests/k6/`, `docs/`.
El plan técnico y el estado de cada requisito están en `docs/entregas.md`. Escribe la UI y la documentación en español.
Dos tipos de cuenta: el **personal** (admin, receptionist, storekeeper, developer) entra con correo y contraseña y lo
registran el Administrador o el Programador (`/auth/register`; hay un solo Programador: nadie crea otro ni le quita el rol); los **clientes**
(`client`) entran solo con Google; su nombre completo, DNI y celular son opcionales hasta reservar (Mi perfil, `clients.user_id`)
y reservan desde `/api/v1/portal/*`.

## Reglas del proyecto

- Toda respuesta de la API usa `App\Support\ApiResponse` (formato único). Los errores de negocio se lanzan con
  `App\Exceptions\ApiException` (p. ej. `ApiException::conflict(...)` → 409); nunca devuelvas HTML ni trazas.
- Cada endpoint de escritura valida con un FormRequest (`app/Http/Requests`, base `ApiFormRequest`).
- Autorización: middleware `role:` en `routes/api.php` y policies para reglas por registro (`ReservationPolicy`).
- Los modelos de negocio usan el trait `Auditable`.
- Los listados paginan en el servidor con `$this->perPage($request)` (máximo 50) y `ApiResponse::paginated`.
- Frontend: llamadas con `getList/getOne/send` de `web/src/lib/api.ts`; el interceptor maneja 401/403/429/5xx.
- Idioma: todo texto visible va con `t('texto en español')` (`web/src/lib/i18n.tsx`) y su inglés en `web/src/lib/i18n.en.ts`;
  los mensajes de la API usan `__()` con su inglés en `api/lang/en.json`. La web envía `Accept-Language`.
  Formularios: estado inicial desde props y `key` para remontar (la regla `react-hooks/set-state-in-effect` está activa).
- Estilo visual: skill `design-taste-frontend`, estilo "framed-sheet" (`.taste-skill/direction.json`), tokens en `web/src/styles.css`.
- Registra cualquier caída (incluso local) en `docs/incidentes.md`.
- Antes de crear recursos en AWS, avisa y da el costo (ver `infra/README.md`).

## Comandos

```bash
cd api && php -d extension=pdo_sqlite vendor/bin/pest      # Windows: pdo_sqlite se carga con -d
cd api && vendor/bin/phpstan analyse && vendor/bin/pint
cd web && npm run lint && npm run typecheck && npm test && npm run build
```
