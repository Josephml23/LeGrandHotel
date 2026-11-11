# LeGrandHotel

Sistema web **interno** de gestión de hospedaje para el personal del hotel: habitaciones y tipos, reservas y
estadías, cochera, fichas de huéspedes, personal e inventario. No tiene registro público: las cuentas las crea el Administrador. API en **Laravel 12** y frontend en **React 18 + TypeScript**, preparado para
desplegarse en **AWS**.

Curso: Desarrollo de Soluciones en la Nube — TECSUP.
Equipo: Joseph Fredy Marcani Leyva · Leo Mathiu Pinto Garate · Diego Armando Huacca Ccaso · Rusell Quispe Encarnación.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| [`api/`](api) | API REST `/api/v1`: Sanctum, roles y policies, Socialite (Google), verificación de correo, rate limits, formato JSON único, auditoría, logs JSON, Pest |
| [`web/`](web) | SPA React: rutas protegidas por rol, TanStack Query, Axios con manejo central de 401/403/429/5xx, pantallas de error, build ofuscado |
| [`infra/`](infra) | Terraform (VPC, EC2 + ASG, ALB, RDS, ElastiCache, S3 + CloudFront, CloudWatch, SSM, ECR, presupuesto), Docker y scripts de respaldo |
| [`tests/k6/`](tests/k6) | Pruebas de carga, estrés, pico, resistencia, smoke y rate limit |
| [`docs/`](docs) | Diagramas, endpoints (OpenAPI), pruebas, seguridad, incidentes, migración y checklist de entregas |
| [`.github/workflows/`](.github/workflows) | CI (Pint, PHPStan, Pest, ESLint, Vitest, audits, Semgrep) y despliegue a AWS |

## Arranque rápido

### Con Docker (MySQL + Redis, como en producción)

```bash
cp api/.env.example api/.env        # pon DB_PASSWORD igual a MYSQL_PASSWORD de docker-compose.yml
docker compose up -d --build
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

API: http://localhost:8000/api/v1/health · Web: http://localhost:5173

### Día a día: encender la página

Una vez instalado, para volver a levantarlo basta con esto:

1. **Abre Docker Desktop** y espera a que el ícono de la ballena deje de moverse (~1 minuto). De él cuelga todo.
2. En una terminal, dentro del proyecto:

```bash
docker compose up -d mysql redis app nginx
```

3. En otra terminal, la web:

```bash
cd web && npm run dev
```

Web: http://localhost:5173 · API: http://localhost:8000/api/v1/health

La primera petición a la API tarda unos segundos porque PHP arranca en frío; si ves un 503 al principio,
espera y recarga. Para apagar todo al terminar: `docker compose down`.

### Sin Docker (SQLite)

```bash
cd api
composer install
cp .env.example .env               # cambia DB_CONNECTION=sqlite, CACHE_STORE=file, QUEUE_CONNECTION=sync
php artisan key:generate
php artisan migrate --seed
php artisan db:seed --class=MassiveDataSeeder   # opcional: 50 habitaciones, 1000 clientes, 5000 reservas
php artisan serve

cd ../web
cp .env.example .env
npm install
npm run dev
```

Cuentas de demostración (`DemoSeeder`, contraseña `DEMO_PASSWORD` del `.env`, solo desarrollo):
`admin@`, `recepcion@`, `almacen@` y `dev@legrandhotel.test`.

## Calidad

```bash
cd api && composer test && vendor/bin/phpstan analyse && vendor/bin/pint --test && composer audit
cd web && npm run lint && npm run typecheck && npm test && npm audit && npm run build
```

Resultados actuales en [`docs/pruebas/README.md`](docs/pruebas/README.md); estado de cada requisito en
[`docs/entregas.md`](docs/entregas.md).
