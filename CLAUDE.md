# LeGrandHotel — guía para Claude Code

Monorepo: `api/` (Laravel 12, Pest), `web/` (React 18 + TS + Vite), `infra/` (Terraform, Docker), `tests/k6/`, `docs/`.
El plan técnico y el estado de cada requisito están en `docs/entregas.md`. Escribe la UI y la documentación en español.
Es un sistema **solo interno** del hotel: no hay rol Cliente ni registro público (los huéspedes son fichas en `clients`).

## Reglas del proyecto

- Toda respuesta de la API usa `App\Support\ApiResponse` (formato único). Los errores de negocio se lanzan con
  `App\Exceptions\ApiException` (p. ej. `ApiException::conflict(...)` → 409); nunca devuelvas HTML ni trazas.
- Cada endpoint de escritura valida con un FormRequest (`app/Http/Requests`, base `ApiFormRequest`).
- Autorización: middleware `role:` en `routes/api.php` y policies para reglas por registro (`ReservationPolicy`).
- Los modelos de negocio usan el trait `Auditable`.
- Los listados paginan en el servidor con `$this->perPage($request)` (máximo 50) y `ApiResponse::paginated`.
- Frontend: llamadas con `getList/getOne/send` de `web/src/lib/api.ts`; el interceptor maneja 401/403/429/5xx.
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
