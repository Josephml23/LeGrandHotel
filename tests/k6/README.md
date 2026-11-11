# Pruebas de carga y estrés (k6)

| Script | Para qué | Entrega |
| --- | --- | --- |
| `smoke.js` | 20 VU · 1 min antes y después de cada despliegue | todas |
| `rate-limit.js` | Demuestra la espera del login (401 y luego 429 `LOGIN_LOCKED`) | 25% / 80% |
| `reservas.js` `PROFILE=carga-25` | 50 → 100 VU, p95 < 500 ms, 0% errores | 25% |
| `reservas.js` `PROFILE=carga-80 VUS=1000/3000/5000` | carga a 1000, 3000 y 5000 VU | 80% |
| `inicio-reserva.js` | **Un usuario por usuario virtual**: inicia sesión UNA vez (como en la vida real) y luego registra reservas con pausa de 10 s. Dura 1 minuto exacto | 80% |
| `clientes-1000-reservas.js` | **50 clientes del portal registran 1000 reservas** (trabajo fijo): mide cuánto tardan y si cumplen los tiempos | 80% |
| `correr-bloques.sh 1000` / `5000` | `PROFILE=bloques`: sube de 100 en 100 usuarios; guarda HTML, resumen y cada petición (CSV) y detiene k6 si queda poca RAM | 80% |
| `reservas.js` `PROFILE=estres / pico / resistencia` | punto de quiebre, picos y 30 min | 100% |
| `portal.js` `VUS=100` | **Clientes** en el portal: 60% buscan habitaciones, 25% ven sus reservas, 15% reservan | extra |

Escenario (recepción): 70% lecturas (habitaciones disponibles, reservas, tipos), 20% login y 10% crear reserva.
Los usuarios virtuales son recepcionistas de prueba (`LoadTestUsersSeeder`) y reservan a nombre de huéspedes de `MassiveDataSeeder`.
Los `thresholds` hacen que la corrida falle sola si no se cumple la meta.

Escenario de clientes (`portal.js`): los clientes entran solo con Google y k6 no puede iniciar sesión en Google, así que
`LoadTestClientsSeeder` crea clientes de prueba con DNI y teléfono y les abre la sesión (token de 24 h en
`tests/k6/.tokens-clientes.json`, fuera de git). Si hay más usuarios virtuales que clientes, comparten la sesión.

```powershell
cd api; $env:K6_CLIENTS="50"; php artisan db:seed --class=LoadTestClientsSeeder; cd ..
k6 run -e BASE_URL=http://127.0.0.1:8000/api/v1 -e VUS=100 tests/k6/portal.js
cd api; php artisan k6:limpiar          # borra cuentas de carga (recepcionistas y clientes) y sus reservas
php artisan k6:limpiar --masivos         # además, los huéspedes de MassiveDataSeeder y sus reservas
```

### Inicio de sesión y reservas, por usuario (1 minuto)

Cada usuario virtual usa su propia cuenta (`k6-0`, `k6-1`, …), inicia sesión una sola vez y después registra
reservas. Es el escenario realista: un recepcionista entra una vez por turno, no en cada clic.

```powershell
cd api; docker exec -e K6_USERS=1000 legrandhotel-app-1 php artisan db:seed --class=LoadTestUsersSeeder --force; cd ..
k6 run -e BASE_URL=http://localhost:8000/api/v1 -e VUS=150 -e PAUSA=10 tests/k6/inicio-reserva.js
```

`VUS` son los usuarios y `PAUSA` los segundos entre una reserva y la siguiente (10 s es lo realista).
La prueba dura 60 s: 15 s subiendo, 40 s sostenidos y 5 s bajando. Mide por separado `login_ms` y `reserva_ms`,
y cuenta las reservas creadas y las que encontraron la habitación ocupada (409, que es la respuesta correcta).

### Prueba de reservas en tres pasos

```bash
bash tests/k6/preparar.sh 50 --limpiar
k6 run -e BASE_URL=http://localhost:8000/api/v1 -e CLIENTES=50 -e RESERVAS=5000 -e BUSCAR=una-vez tests/k6/clientes-1000-reservas.js
bash tests/k6/restaurar.sh
```

`preparar.sh` enciende los contenedores, sube los límites de peticiones solo para la prueba, siembra los
clientes y calienta la API. `--limpiar` borra además las reservas que dejaron las pruebas anteriores: hace
falta cuando el calendario se llena, porque con el hotel lleno las reservas nuevas chocan y el resultado deja
de medir el sistema. `restaurar.sh` devuelve la API a su configuración normal.

**Cuántos clientes poner.** Medido en la laptop del equipo:

| Clientes a la vez | Resultado |
| ---: | --- |
| 50 | 16,8 reservas/s, 0% de errores. Es el número que da resultados útiles |
| 500 | Desde Windows el proxy de Docker Desktop rechaza las conexiones (94% de fallos). Desde dentro de Docker no hay rechazos, pero los 20 procesos PHP-FPM no alcanzan y Nginx corta a los 10 s (504) |

### 50 clientes registrando 1000 reservas

Trabajo fijo: la prueba termina cuando se completan las 1000 reservas, no a los X segundos. Cada iteración es
una reserva completa del portal (buscar tipos libres y reservar uno).

```powershell
cd api; $env:K6_CLIENTS="50"; php artisan db:seed --class=LoadTestClientsSeeder --force; cd ..
k6 run -e BASE_URL=http://localhost:8000/api/v1 -e PAUSA=6 tests/k6/clientes-1000-reservas.js
```

`CLIENTES` (50), `RESERVAS` (1000) y `PAUSA` (segundos entre una reserva y la siguiente) se cambian con `-e`.
`BUSCAR=una-vez` consulta los tipos de habitación una sola vez al empezar: cada iteración solo reserva, es la
mitad de peticiones y las 1000 salen en ~35 s en vez de ~58 s. Con `BUSCAR=cada-vez` (por defecto) cada cliente
busca antes de reservar, como en la web.
Con `PAUSA=0` mide la velocidad máxima; con `PAUSA=6` imita a clientes reales y cumple las metas del 80%.

### Si la prueba da «connection refused»

No es Nginx. En Windows, Docker Desktop publica `localhost:8000` con un proxy propio que aguanta unos
cientos de conexiones a la vez; con 500 clientes de golpe rechaza la mayoría y la prueba mide ese proxy,
no la API. Se comprobó: la misma corrida de 500 clientes dio 3661 rechazos por `localhost:8000` y **0**
desde dentro de la red de Docker.

Para medir la API de verdad, corre k6 dentro de Docker:

```bash
bash tests/k6/preparar.sh 50
bash tests/k6/dentro.sh clientes-1000-reservas.js CLIENTES=50 RESERVAS=1000 BUSCAR=una-vez
bash tests/k6/restaurar.sh
```

El primer argumento es el script de `tests/k6/`; los demás son variables de k6 (`CLAVE=valor`). `BASE_URL`
lo pone el script solo (`http://nginx/api/v1`), así que no hay que pasarlo.

Dentro de Docker ya no hay rechazos, pero aparece el tope real de la laptop: 20 procesos PHP-FPM. Con 500
clientes a la vez las peticiones esperan más de 10 s y Nginx las corta con 504. Para que la prueba termine
sin errores hay que quedarse en ~50–100 clientes, o subir `pm.max_children` (y la CPU que lo aguante).

## Cómo correrlas

1. **Nunca desde la laptop**: desde una EC2 generadora en `us-east-1` (para 10 000+ VU, 3–5 generadoras que se apagan al terminar).
2. En el entorno de pruebas sube los límites para que los 429 no cuenten como errores:
   `RATE_LIMIT_API=100000 RATE_LIMIT_LOGIN=100000 RATE_LIMIT_REGISTER=100000`.
3. Genera el reporte HTML con gráficos directo en `docs/pruebas/`:

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=docs/pruebas/carga-25-100vu.html \
  k6 run -e BASE_URL=https://api.<dominio>/api/v1 -e PROFILE=carga-25 tests/k6/reservas.js

K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=docs/pruebas/carga-80-3000vu.html \
  k6 run -e BASE_URL=https://api.<dominio>/api/v1 -e PROFILE=carga-80 -e VUS=3000 -e USERS=500 tests/k6/reservas.js
```

Mínimo 3 corridas por entrega (carga normal, estrés y pico), cada una con su HTML en `docs/pruebas/`.
