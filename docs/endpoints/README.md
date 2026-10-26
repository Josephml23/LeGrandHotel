# Endpoints de la API

Todas las rutas viven bajo `/api/v1`, responden JSON y, salvo autenticación y salud, exigen token
Bearer de Sanctum. Los listados aceptan `?page=` y `?per_page=` (máximo 50) y filtros por query string.
La especificación completa está en [`openapi.yaml`](openapi.yaml) (ábrela en https://editor.swagger.io)
y el código en `api/routes/api.php` (`php artisan route:list --path=api`).

## Formato único de respuesta

```json
{ "success": true, "data": { }, "meta": { "page": 1, "per_page": 15, "total": 120, "last_page": 8 } }
{ "success": false, "error": { "code": "ROOM_ALREADY_BOOKED", "message": "…", "details": { } } }
```

## Rutas

| Módulo | Método y ruta | Roles | Entrega |
| --- | --- | --- | --- |
| Salud | `GET /health` (app, BD, caché) | Público | 25% |
| Auth | `POST /auth/register` (3/min) | Público | 25% |
| Auth | `POST /auth/login` (5/min por IP+correo) | Público | 25% |
| Auth | `POST /auth/logout` · `GET /auth/me` | Autenticado | 25% |
| Auth | `POST /auth/refresh` (token nuevo, revoca el anterior) | Autenticado | 80% |
| Auth | `GET /auth/google/redirect` · `GET /auth/google/callback` | Público | 80% |
| Auth | `POST /email/verification-notification` · `GET /email/verify/{id}/{hash}` (firmado) | Autenticado / enlace firmado | 80% |
| Panel | `GET /dashboard` (resumen según rol) | Autenticado | 80% |
| Tipos de habitación | `GET /room-types` · `GET /room-types/{id}` | Admin, Recepción, Cliente | 25% |
| Tipos de habitación | `POST` · `PUT` · `DELETE /room-types/{id}` | Admin | 25% |
| Habitaciones | `GET, POST /rooms` · `GET, PUT, DELETE /rooms/{id}` · `PATCH /rooms/{id}/status` | Admin, Recepción | 25% |
| Habitaciones | `GET /rooms/available?from=&to=&guests=` | Admin, Recepción, Cliente | 80% |
| Clientes | CRUD `/clients` | Admin, Recepción | 80% |
| Clientes | `GET, PUT /me/client` (perfil propio) | Cliente | 80% |
| Reservas | CRUD `/reservations` (409 si se cruzan fechas) | Admin, Recepción, Cliente (solo las suyas) | 80% |
| Estadías | `POST /reservations/{id}/check-in` · `GET /stays` · `POST /stays/{id}/check-out` | Admin, Recepción | 80% |
| Cochera | CRUD `/parking-spots` · CRUD `/parking-assignments` | Admin, Recepción | 80% |
| Personal | CRUD `/staff` | Admin | 80% |
| Inventario | CRUD `/inventory-items` · `GET, POST /inventory-items/{id}/movements` | Admin, Almacenero | 80% |
| Usuarios y roles | CRUD `/users` · `PUT /users/{id}/roles` | Admin | 80% |
| Reportes | `GET /reports/occupancy` · `GET /reports/income` | Admin | 100% |
| Auditoría | `GET /audit-logs` | Admin | EXTRA |

## Códigos HTTP

| Código | Cuándo | `error.code` de ejemplo |
| --- | --- | --- |
| 200 / 201 / 204 | Lectura, creación, eliminación correctas | — |
| 400 | JSON mal formado | `BAD_REQUEST` |
| 401 | Sin token, token expirado o credenciales incorrectas | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | Rol sin permiso (aunque la ruta se pida a mano) | `FORBIDDEN` |
| 404 | Recurso o ruta inexistente | `ROOM_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 405 | Método no permitido | `METHOD_NOT_ALLOWED` |
| 409 | Conflicto de negocio | `ROOM_ALREADY_BOOKED`, `INSUFFICIENT_STOCK`, `PARKING_SPOT_NOT_FREE` |
| 422 | Validación fallida (FormRequest) | `VALIDATION_FAILED`, `CAPACITY_EXCEEDED` |
| 429 | Rate limit superado (cabecera `Retry-After`) | `TOO_MANY_REQUESTS` |
| 500 | Error interno: mensaje claro + `incident_id`, sin trazas | `INTERNAL_ERROR` |
| 503 | BD caída o mantenimiento: motivo + `Retry-After: 30` | `DATABASE_UNAVAILABLE`, `SERVICE_UNAVAILABLE` |

Cada código tiene su prueba en `api/tests/Feature` (ver `docs/pruebas/README.md`).
