# Despliegue en Render

Render hospeda las tres piezas del proyecto: la **API** (Laravel en Docker), la **web** (React como sitio
estático) y la **base de datos** (PostgreSQL administrado). Todo lo define `render.yaml` en la raíz del repositorio.

> **Por qué PostgreSQL y no MySQL.** Render solo administra PostgreSQL; MySQL habría que levantarlo como
> servicio privado con disco, y ni los servicios privados ni los discos existen en el plan gratuito.
> El código funciona con los dos: ver «Compatibilidad» más abajo.

## Qué se crea y cuánto cuesta

| Servicio | Qué es | Plan |
| --- | --- | --- |
| `legrandhotel-api` | API en Docker (Nginx + PHP-FPM en un contenedor) | Gratis |
| `legrandhotel-web` | Sitio estático con el build de Vite | Gratis |
| `legrandhotel-db` | PostgreSQL 16 administrado | Gratis |

**Costo: 0 USD.** Confirma los planes en render.com/pricing antes de crear, porque Render los cambia.

## Pasos

### 1. Generar la clave de la aplicación

Desde `api/`, sin guardarla en el repositorio:

```bash
php artisan key:generate --show
```

Copia el resultado completo, incluido el prefijo `base64:`.

### 2. Crear los servicios

En render.com: **New → Blueprint**, elige el repositorio `Josephml23/LeGrandHotel` y aplica el plan.
Render lee `render.yaml` y crea los tres servicios. El primer despliegue falla a propósito: faltan las
variables secretas.

### 3. Completar las variables

En **legrandhotel-api → Environment**:

| Variable | Valor |
| --- | --- |
| `APP_KEY` | lo que devolvió el paso 1 |
| `FRONTEND_URL` | `https://legrandhotel-web.onrender.com` |
| `GOOGLE_CLIENT_ID` | el de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | el de Google Cloud Console |
| `DEMO_PASSWORD` | solo si vas a sembrar datos de ejemplo |

**La web no necesita ninguna variable:** arma sola la dirección de la API con la que Render le asigna.
Tampoco hace falta `GOOGLE_REDIRECT_URI`: sale de la dirección del propio servicio.

La dirección exacta de la web la da Render al crearla; si cambiaste los nombres de los servicios, usa la que
aparezca en el panel. Guarda los cambios: Render vuelve a desplegar solo.

### 4. Autorizar la dirección en Google

En Google Cloud Console → Credenciales → tu ID de cliente OAuth, agrega en **URIs de redireccionamiento
autorizados** la dirección de regreso de la API:

```
https://legrandhotel-api.onrender.com/api/v1/auth/google/callback
```

Sin esto, el ingreso con Google falla. Es el único dato que hay que copiar a mano en los dos lados.

### 5. Comprobar

```bash
curl https://legrandhotel-api.onrender.com/api/v1/health
```

Debe responder `200` con `"status":"ok"` y la base en `ok`. Las migraciones corren solas al arrancar
(`RUN_MIGRATIONS=true`). Luego abre `https://legrandhotel-web.onrender.com`.

### 6. Datos de ejemplo (opcional)

El plan gratuito **no da consola**, así que se siembra con una variable: en
**legrandhotel-api → Environment**, pon `RUN_SEED` en `true`, guarda, espera a que termine el despliegue
y vuelve a ponerlo en `false`.

Crea los roles, las cuentas de demostración (con la contraseña de `DEMO_PASSWORD`), las habitaciones, la
cochera y el inventario. `DemoSeeder` es idempotente: repetirlo no duplica nada.

> `MassiveDataSeeder` **no funciona en Render**: usa Faker, que es una dependencia de desarrollo y la imagen
> se construye con `--no-dev`. Los datos masivos son solo para las pruebas de carga en local.

> Si al aplicar el blueprint Render rechaza la sección `routes` del sitio estático, crea la regla a mano en
> **legrandhotel-web → Redirects/Rewrites**: origen `/*`, destino `/index.html`, acción *Rewrite*.

## Compatibilidad con PostgreSQL

El proyecto corre con MySQL (local y AWS), PostgreSQL (Render) y SQLite (pruebas). Lo que hubo que ajustar:

- **Búsquedas.** MySQL no distingue mayúsculas por su collation; PostgreSQL sí. `Controller::likeOperator()`
  devuelve `ilike` en PostgreSQL y `like` en el resto, así que buscar «ana» encuentra a «Ana» en los dos.
- **Reporte de ingresos.** Agrupa por mes con `to_char(check_in, 'YYYY-MM')` en PostgreSQL,
  `DATE_FORMAT` en MySQL y `strftime` en SQLite (`ReportController::income`).
- **Imagen.** `api/Dockerfile.render` instala `pdo_pgsql` además de `pdo_mysql`.

Comprobado el 2026-11-10 contra un PostgreSQL 16 real, con la imagen de Render: las 8 migraciones corrieron,
`/health` respondió `ok` con base y caché, el ingreso con contraseña funcionó, el reporte de ingresos agrupó por
mes (`2026-11` y `2026-12`) y la búsqueda de «ana» encontró a «Ana María Torres».

## Versión de Node

El sitio estático se construye con **Node 22** (`NODE_VERSION` en `render.yaml`), porque Vite 8 exige
20.19 o superior. Si Render usara su versión por defecto, el build podría fallar.

## Lo que hay que tener en cuenta del plan gratuito

- **Se duerme** a los 15 minutos sin visitas y tarda cerca de un minuto en despertar. Antes de una
  demostración, abre la página unos minutos antes.
- **La base gratuita vence a los 30 días** de creada. Anota la fecha; después hay que crear otra o pagar.
- **El disco es efímero:** no guardes archivos en el servidor. Por eso los logs van a la salida estándar.
- **Render dice que no lo uses para producción.** Para la entrega sirve; para carga real, no.
- **No sirve para las pruebas de carga.** La instancia gratuita es una fracción de un procesador: las 1000
  reservas que la laptop registra en 58 s tardarían mucho más. Las mediciones de `docs/pruebas/` se hicieron
  en la laptop y así deben presentarse.

## Diferencias con el despliegue en AWS

`infra/terraform` sigue siendo el despliegue pensado para carga real: balanceador con Auto Scaling, RDS,
ElastiCache y varias instancias. Render es el despliegue de demostración, gratuito y de un solo servidor.
La API usa `api/Dockerfile` en AWS (solo PHP-FPM, con Nginx aparte) y `api/Dockerfile.render` en Render.
