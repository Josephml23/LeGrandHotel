# LeGrandHotel

Sistema web de gestión de hospedaje: habitaciones y tipos, reservas y estadías, cochera, clientes,
personal e inventario. API en **Laravel 12** y frontend en **React 18 + TypeScript**, preparado para
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
`admin@`, `recepcion@`, `almacen@` y `cliente@legrandhotel.test`.

## Calidad

```bash
cd api && composer test && vendor/bin/phpstan analyse && vendor/bin/pint --test && composer audit
cd web && npm run lint && npm run typecheck && npm test && npm audit && npm run build
```

Resultados actuales en [`docs/pruebas/README.md`](docs/pruebas/README.md); estado de cada requisito en
[`docs/entregas.md`](docs/entregas.md).
