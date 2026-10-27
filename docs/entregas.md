# Checklist de entregas (Pasos para presentación de entregables, semanas 9-11-13)

Regla del profesor: presentar **solo lo evaluado** en cada entrega; todo lo demás se presenta diciendo que es **extra**.
Marca una casilla solo cuando la evidencia esté en la documentación.

Leyenda: ✅ hecho y probado en código · ☁️ código listo, falta crear el recurso en AWS / correr la prueba en AWS · ⬜ pendiente

## Entrega 25% (semana 9)

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Entorno cloud preparado (cuenta AWS, VPC, EC2, RDS) | ☁️ | `infra/terraform` (network, compute, data); faltan capturas de la consola |
| Endpoints definidos | ✅ | `api/routes/api.php`, `docs/endpoints/README.md`, `docs/endpoints/openapi.yaml` |
| Registro y login diferenciados y funcionales | ✅ | `/auth/register` (personal: Administrador y Programador) y `/auth/login`; clientes con Google + DNI y teléfono (`/completar-registro`); `AuthTest`, `ClientPortalTest`, `forms.test.tsx`, `client.test.tsx` |
| EXTRA: VPC con subredes privadas | ☁️ | `infra/terraform/network.tf` |
| EXTRA: diagrama de BD | ✅ | `docs/diagramas/legrandhotel.dbml` |
| EXTRA: cifrar el código | ✅ | build ofuscado (`web/vite.config.ts`), comparación en `docs/seguridad.md` |
| EXTRA: diseño de la app móvil (Android e iOS) | ✅ | `docs/movil/diseno-app-movil.md`, bocetos y arquitectura en `docs/movil/`; se construye en el 80% y 100% |

## Entrega 80% (semana 11)

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Rate limits | ✅ | login 5/min, registro 3/min, API 60/min; 429 con `Retry-After` en pruebas y `tests/k6/rate-limit.js` |
| Vista 404 y "En construcción" | ✅ | `web/src/pages/errors/ErrorPages.tsx` (ruta `*` y `/facturacion`) |
| Control de respuestas HTTP | ✅ | formato único + tabla de códigos en `docs/endpoints/README.md` |
| CRUD estructurado | ✅ | todos los módulos con CRUD completo |
| Variables de entorno | ✅ | `.env` fuera de Git, `api/.env.example`, `web/.env.example` |
| Cifrado de contraseñas | ✅ | cast `hashed` (bcrypt) |
| Pruebas unitarias y masivas | ✅ | Pest unit + feature; `MassiveDataSeeder` (50 / 1000 / 5000) |
| BD conectada + diagrama editable | ✅ | migraciones + DBML |
| Pruebas con 50–100 usuarios (k6) | ☁️ | `tests/k6/reservas.js PROFILE=carga-25`; falta el HTML de la corrida en AWS |
| CRUD completo en todos los módulos | ✅ | clientes, reservas, estadías, cochera, personal, inventario, usuarios |
| Paginación rápida + índices | ✅ | `per_page` ≤ 50, índices del plan; listado de 5000 reservas < 500 ms en `MassiveDataTest` |
| Múltiples tipos de usuario | ✅ | Administrador, Recepcionista, Almacenero, Programador (correo y contraseña) y Cliente (solo Google: reserva por tipo de habitación y ve sus reservas) |
| Proyecto en el servidor y pruebas revisadas | ☁️ | pipeline `deploy.yml` listo |
| CORS solo para el frontend | ✅ | `config/cors.php` + prueba |
| Smoke test antes de cada despliegue | ✅ | `tests/k6/smoke.js` en `deploy.yml` |
| Autenticación y autorización | ✅ | Sanctum + roles + policies |
| Ingreso con cuenta de correo | ✅ | Google (Socialite) + verificación de correo; faltan credenciales OAuth de Google en SSM |
| Tokens expirados y rutas protegidas | ✅ | 60 min, refresh, prune diario, `ProtectedRoute` |
| Pantallas de errores previstos | ✅ | 500, 503 (reintento cada 30 s), sin conexión, sesión expirada, 429 con cuenta regresiva, 403 |
| Pruebas con 1000–5000 usuarios | ☁️ | `PROFILE=carga-80 VUS=1000/3000/5000` |
| Backups | ☁️ | snapshots RDS 7 días + `backup-mysql-to-s3.sh` + `restore-test.sh` |
| EXTRA: Redis (caché, colas) | ☁️ | ElastiCache en Terraform, worker y scheduler en Docker |

## Entrega 100% (semana 13)

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Proyecto funcional al 100% | ✅ | API + web completas; falta desplegar |
| Pruebas con 10 000–50 000 usuarios | ☁️ | `PROFILE=estres/pico/resistencia` desde 3–5 EC2 generadoras |
| Cuellos de botella con antes/después | ⬜ | plantilla en `docs/pruebas/README.md` |
| Logs JSON centralizados en CloudWatch | ✅/☁️ | canal `json` + `RequestContext`; agente y grupo `/legrandhotel/api` en Terraform |
| Errores contenidos, tiempos controlados, motivo al usuario | ✅ | timeouts 10 s Nginx/PHP, 3 s BD, 503 con motivo y `Retry-After`, modo mantenimiento |
| EXTRA: CI/CD con GitHub Actions | ✅ | `.github/workflows/ci.yml` y `deploy.yml` (OIDC, ECR, instance refresh, smoke, rollback) |
| EXTRA: migración sin pérdida de servicio | ✅ | `docs/migracion-servidor.md` |
| EXTRA: uso de recursos (Redis, colas, OPcache, workers) | ✅ | `api/docker/php.ini`, `fpm.conf`, compose de producción |
| Documentación con carátula TECSUP | ⬜ | se genera por entrega (Word) con la skill `caratula-tecsup` |
| Diagramas de rendimiento (varias corridas) | ☁️ | HTML de k6 en `docs/pruebas/` |
| Registro de caídas | ✅ | `docs/incidentes.md` (se actualiza en cada caída) |

## Preguntas abiertas para el profesor

- ¿"Ingreso mediante cuenta de correo" es login con Google o verificación por correo? (Se implementaron ambos.)
- ¿TECSUP da acceso a AWS Academy (Learner Lab)? Cambia la forma de crear el rol de OIDC y el presupuesto.
- ¿"10 000 – 50 000" son usuarios concurrentes o peticiones totales? Cambia mucho el costo en AWS.
