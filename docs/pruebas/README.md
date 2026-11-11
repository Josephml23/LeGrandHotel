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

## Pruebas de carga locales (k6, 2026-10-27) — EXTRA de la entrega del 25%

Equipo de desarrollo (Windows, PHP 8.2, servidor integrado de PHP de un solo proceso, SQLite, caché en archivo).
Escenario `reservas.js PROFILE=escalon`: 70% lecturas, 20% login, 10% crear reserva; 10 s de subida, 45 s sostenidos.

| Corrida | Peticiones | Pet./s | p50 | p95 | Errores | Reporte |
| --- | --- | --- | --- | --- | --- | --- |
| Smoke 5 VU (salud, BD, caché, 401) | 222 | 7.1 | 203 ms | 321 ms | 0% | `local-smoke-5vu.html` |
| Escalón 5 VU | 350 | 4.4 | 288 ms | 528 ms | 0% | `local-escalon-5vu.html` |
| Escalón 10 VU | 413 | 5.2 | 910 ms | 1 309 ms | 0% | `local-escalon-10vu.html` |
| Escalón 25 VU | 438 | 5.2 | 3 361 ms | 3 952 ms | 0% | `local-escalon-25vu.html` |
| Escalón 50 VU | 483 | 5.3 | 7 016 ms | 7 885 ms | 0% | `local-escalon-50vu.html` |

**Repetición del 2026-10-27 (noche) con informe propio:** `docs/pruebas/informe-k6/` (Word y PDF con capturas de
cada comando y su respuesta). Smoke 5 VU p95 323 ms · 429 en el 6.º login · escalones 5/10/25/50 VU con p95
610 ms / 1.8 s / 4.6 s / 9.3 s, ~4.8 pet./s y 0% errores. Se repite con `docs/pruebas/informe-k6/correr.sh`.

**Mejora medida (2026-10-28, 50 clientes del portal con `tests/k6/portal.js`, misma laptop y misma base MySQL):**

| Cómo corre la API | Peticiones en 1 min | Pet./s | p95 | Crear reserva (p95) | Errores |
| --- | --- | --- | --- | --- | --- |
| `php -S` (servidor de desarrollo, 1 petición a la vez, sin OPcache) | 317 | 4,6 | 11 099 ms | 11 223 ms | 0% |
| Nginx + PHP-FPM (20 procesos) + OPcache, en Docker | 950 | 15,0 | 1 430 ms | 1 500 ms | 0% |
| Lo anterior + caché de Laravel (`config:cache`, `route:cache`, `event:cache`) | 1 221 | 19,2 | 614 ms | 669 ms | 0% |

Con la misma configuración que se usará en el servidor (PHP-FPM, OPcache y caché de Laravel) se atienden **4 veces más
peticiones** y el p95 baja **18 veces** (de 11,1 s a 0,6 s); las búsquedas ya cumplen su meta (p95 < 800 ms).
Salidas en `informe-k6/salidas/5-fpm-*` y `6-fpm-cache-*`. Para repetirlo: `docker compose up -d nginx app redis mysql`,
`docker compose exec app php artisan config:cache` (y `route:cache`, `event:cache`), `docker compose restart app`;
al terminar, `docker compose exec app php artisan optimize:clear` (si no, la API corrida desde Windows lee `DB_HOST=mysql`).

**Cuello de botella:** el servidor integrado de PHP atiende una petición a la vez, así que se satura en ~5 pet./s y
la latencia crece con la cola (todas las operaciones tienen el mismo p95). Sin errores: responde lento pero no se cae.
**Corrección prevista (80%):** Nginx + PHP-FPM (20 procesos), OPcache, RDS y Redis; repetir las corridas en AWS.

Gráficos (escala de grises): `docs/pruebas/graficos/` — se regeneran con `python docs/pruebas/graficos.py`.
Datos crudos (resúmenes JSON y CSV por petición): `docs/pruebas/datos/`.

**Bloques de 100 usuarios en la laptop (2026-11-10, Nginx + PHP-FPM 20 procesos + OPcache + caché de Laravel, en Docker):**
`bash tests/k6/correr-bloques.sh 1000` sube de 100 en 100 usuarios (10 s subiendo y 20 s sostenido por bloque).

| Corrida | Peticiones | Pet./s | p95 | Errores | Archivo |
| --- | --- | --- | --- | --- | --- |
| 1000 VU completa (6 min) | 23 137 | 61 | 11,0 s | 77,7% | `local-bloques-1000vu.html`, `datos/local-bloques-1000vu.json` y `.txt` |
| 5000 VU | — | — | — | — | cancelada a pedido del equipo (con 1 GB de RAM libre, k6 no cabía en la laptop) |
| 1000 VU en **1 minuto en total** (bloques de 100 cada 5 s) | 4 903 | 44,6 | 10,0 s | 75,0% | `local-bloques-1000vu-5s.html`, `datos/local-bloques-1000vu-5s.*`, `graficos/bloques-1000vu-5s.png` |

Detalle por bloque de una repetición que se canceló a los 300 usuarios (`datos/local-bloques-parcial-300vu.csv.gz`,
se tabula con `python docs/pruebas/bloques.py`):

| Usuarios | Peticiones en el bloque (30 s) | Pet./s | p95 | Errores |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 1 159 | 38,6 | 2,04 s | 0% |
| 200 | 1 223 | 40,8 | 4,51 s | 0% |
| 300 | (bloque incompleto) | — | 5,02 s | 0% |

**1000 usuarios en 1 minuto, por bloque** (`bash tests/k6/correr-bloques.sh 1000 5`, tabla con
`python docs/pruebas/bloques.py 1000:5`; cada bloque dura 5 s: 1 s subiendo y 4 s sostenido):

| Usuarios | Peticiones en el bloque (5 s) | Pet./s | p95 | Errores |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 102 | 20,4 | 3,69 s | 0% |
| 200 | 175 | 35,0 | 4,10 s | 0% |
| 300 | 200 | 40,0 | 4,97 s | 0% |
| 400 | 218 | 43,6 | 6,63 s | 0% |
| 500 | 225 | 45,0 | 8,64 s | 0% |
| 600 | 214 | 42,8 | 9,13 s | 0% |
| 700 | 268 | 53,6 | 10,01 s | 85,1% |
| 800 | 322 | 64,4 | 10,01 s | 100% |
| 900 | 355 | 71,0 | 10,00 s | 100% |
| 1000 | 428 | 85,6 | 10,00 s | 100% |

Hasta 600 usuarios no hay errores, pero el p95 sube de 3,7 s a 9,1 s porque la laptop no pasa de ~45 pet./s. Desde
700 usuarios las peticiones esperan más de 10 s en la cola y Nginx las corta: ese es el **punto de quiebre en local**.
(Desde 700 las «pet./s» suben porque los cortes de Nginx responden rápido, no porque se atienda más.)

**Aguante: 1000 usuarios en 1 minuto y sostenidos 3 minutos** (`bash tests/k6/correr-aguante.sh 1000`, tramos de
10 s con `python docs/pruebas/aguante.py 1000`, gráfico `graficos/aguante-1000vu.png`, reporte `local-aguante-1000vu.html`):
30 916 peticiones, 102,8 pet./s, p95 12,0 s y 95,3% de errores. Respondió **sin ningún error los primeros 35 s** (hasta
~500 usuarios); desde unos 700 usuarios todo falla y con los 1000 sostenidos los 19 tramos tienen 100% de errores, porque la
cola supera los 10 s y Nginx corta cada petición antes de responderla. Al terminar, `/health` siguió en 503 unos 75 s
(la cola se vaciaba) y luego respondió 200 en menos de 0,2 s: no se cae ni pierde datos. Además de más capacidad, conviene
limitar la cola (Nginx `limit_conn`, PHP-FPM `listen.backlog`) para responder 503 al instante a lo que no se puede atender.
Informe con todo esto: `docs/informes/informe-1000/LeGrandHotel_Pruebas_1000.pdf`.

**Lectura:** la laptop atiende un techo de ~40–60 peticiones por segundo (20 procesos PHP-FPM, el login usa bcrypt).
Desde 100 usuarios ya no cumple la meta de p95 < 800 ms, y al seguir subiendo las peticiones esperan más de 10 s,
Nginx corta (504/503) y aparecen los errores (78% en la corrida de 1000). No es una caída de la base: `/health` siguió
respondiendo y al terminar la prueba todo volvió a la normalidad. **Corrección:** más CPU y varias instancias detrás del
balanceador (Auto Scaling en AWS), RDS y Redis; se repite allí con `PROFILE=bloques VUS=1000` y `VUS=5000`.

**Inicio de sesión y creación de reservas, un usuario por usuario virtual** (`tests/k6/inicio-reserva.js`,
2026-11-10, misma laptop con Nginx + PHP-FPM + OPcache + caché de Laravel). Cada usuario inicia sesión **una sola
vez** y luego reserva cada 10 s; la prueba dura 1 minuto. Metas del 80%: p95 < 800 ms y menos de 1% de errores.

| Usuarios | Errores | p95 del login | p95 de la reserva | Reservas creadas | ¿Cumple? |
| ---: | ---: | ---: | ---: | ---: | :--- |
| 20 | 0% | 637 ms | 361 ms | 294 | sí |
| **150** | **0%** | **697 ms** | **569 ms** | **592** | **sí** |
| 200 | 0% | 1,02 s | 757 ms | 727 | no (el login) |
| 300 | 0% | 3,54 s | 3,82 s | 1 173 | no |
| 500 | 20,2% | 10 s | 10 s | 845 | no |
| 1000 | 84,0% | 10 s | 10 s | 121 | no |

**Lectura:** con el escenario realista la laptop sostiene **150 usuarios cumpliendo las dos metas**, y hasta 300
**sin un solo error** aunque lento. El primero que falla es el **inicio de sesión**, no la reserva: cifrar la
contraseña con bcrypt cuesta CPU y en la prueba los usuarios entran todos en los primeros 15 s. Bajar el costo de
bcrypt de 12 a 10 mejoró el p95 del login de 3,5 s a 2,2 s con 300 usuarios (medición aproximada: la tabla de
reservas fue creciendo entre corridas). Es un cambio de seguridad, así que queda a decisión del equipo.

Comparación con el escenario sin pausas (`reservas.js`): allí 1000 usuarios exigen ~1100 peticiones por segundo y
se quiebra en 700; aquí, con pausas realistas de 10 s, exigen ~100 y el límite está en 150–300. La diferencia no es
el servidor, es cuánto pide cada usuario.

**50 clientes del portal registran 1000 reservas** (`tests/k6/clientes-1000-reservas.js`, 2026-11-10, misma
laptop). El trabajo es fijo: la prueba termina al completar las 1000 reservas. Cambia solo la pausa que hace cada
cliente entre una reserva y la siguiente.

| Pausa por cliente | Duración | Reservas creadas | Errores | p95 de la búsqueda | p95 de la reserva | ¿Cumple el 80%? |
| ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| 0 s (a toda velocidad) | 58 s | 1 000 | 0% | 1,81 s | 1,83 s | no, por el tiempo |
| 3 s | 1 min 23 s | 1 000 | 0% | 775 ms | 995 ms | casi |
| **6 s (cliente real)** | **2 min 19 s** | **1 000** | **0%** | **467 ms** | **604 ms** | **sí** |

**Cuál es la forma más rápida de registrar las 1000** (2026-11-10, misma laptop, base ya con ~14 500 reservas):

| Forma de reservar | Duración | Creadas | p95 de la reserva | Errores |
| --- | ---: | ---: | ---: | ---: |
| Como en la web: busca los tipos y reserva (`BUSCAR=cada-vez`) | 57,9 s | 999 | 1,86 s | 0% |
| **Reserva directa con reintento** (`BUSCAR=una-vez`) | **35,2 s** | **1 000** | 2,04 s | 0% |
| Reserva directa con 44 procesos PHP en vez de 20 | 28,9 s | 991 | 2,31 s | 0% |

**La forma más conveniente es la segunda:** `-e BUSCAR=una-vez`. Los tipos de habitación se consultan una
sola vez al empezar y cada iteración solo reserva, así que son 1 petición en vez de 2 y el tiempo baja casi a
la mitad. El reintento cubre los choques (409) cuando dos clientes piden el mismo tipo en las mismas fechas,
y por eso llegan las 1000 completas.

Subir PHP-FPM de 20 a 44 procesos acelera un poco más (28,9 s) pero **responde peor** (p95 de 2,04 s a 2,31 s)
y vuelve a perder reservas por choques: con 20 hilos de CPU, más procesos solo alargan la cola. No compensa.

Ninguna de las tres cumple el p95 < 800 ms, y es esperable: 50 clientes reservando sin pausa es una prueba de
saturación. Para cumplir el tiempo de respuesta hay que darles una pausa realista (6 s → 2 min 19 s, ver arriba)
o más capacidad de servidor.

**Lectura:** en los tres casos se registran **las 1000 reservas sin un solo error**; lo único que cambia es cuánto
tarda y qué tan rápido responde. A toda velocidad el sistema sostiene **17 reservas por segundo**. Con clientes
que se toman 6 segundos entre una reserva y otra —lo normal al elegir fechas y habitación— cumple las dos metas
del 80%: p95 por debajo de 800 ms y 0% de errores. Ninguna reserva se perdió ni se duplicó: el bloqueo por
habitación (`lockForUpdate`) hizo su trabajo con 50 clientes a la vez.

## Carga y estrés (k6)

Los scripts están en `tests/k6/` (ver su README). Cada corrida genera un HTML con gráficos en esta carpeta:

| Entrega | Usuarios virtuales | Archivo esperado | Meta | Estado |
| --- | --- | --- | --- | --- |
| 25% | 50 → 100 | `carga-25-100vu.html` | p95 < 500 ms, 0% errores | pendiente: requiere el servidor en AWS |
| 80% | 1000 / 3000 / 5000 | `carga-80-1000vu.html`, `-3000vu`, `-5000vu` | p95 < 800 ms, < 1% errores | local 1000 VU hecha (no cumple, ver abajo); falta AWS |
| 100% | 10 000 / 25 000 / 50 000 | `estres-*.html`, `pico-*.html`, `resistencia-30min.html` | punto de quiebre y mejora | pendiente |

> Las corridas deben hacerse desde EC2 generadoras en us-east-1, nunca desde la laptop, y con los rate limits
> del entorno de pruebas elevados. Mínimo 3 corridas por entrega (carga normal, estrés y pico).

## Cuellos de botella (plantilla para la entrega del 100%)

| Síntoma (gráfico) | Causa | Corrección | Antes | Después |
| --- | --- | --- | --- | --- |
| | | | | |
