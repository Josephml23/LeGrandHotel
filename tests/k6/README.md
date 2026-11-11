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

## Tutorial: las pruebas de 1000 y 5000 usuarios en un minuto

Los cinco comandos, en orden, desde **Git Bash** en la raíz del proyecto. En cmd escribir `bash` a
secas abre el bash de WSL, que no sirve aquí: abre Git Bash con
`"C:\Program Files\Git\git-bash.exe" --cd=C:\Proyectos\LeGrandHotel`.

Antes de empezar: abre Docker Desktop y espera a que arranque del todo.

### 1. Preparar la API

```bash
bash tests/k6/preparar.sh 50
```

Hace cinco cosas: enciende los contenedores (`mysql`, `redis`, `app`, `nginx`); sube los límites de
peticiones a 100.000 en `api/.env`, porque si no los 429 contarían como errores de la prueba;
siembra 50 clientes del portal; cachea la configuración y las rutas; y calienta la API con tres
llamadas a `/health`, para que la primera petición de la prueba no pague el arranque en frío.

El número es cuántos clientes del portal sembrar. Añadiendo `--limpiar` borra además las reservas
que dejaron las pruebas anteriores; hace falta cuando el calendario se llena, porque con el hotel
lleno las reservas nuevas chocan entre sí y el resultado deja de medir el sistema.

### 2. Sembrar las cuentas de recepción

```bash
docker exec -e K6_USERS=50 legrandhotel-app-1 php artisan db:seed --class=LoadTestUsersSeeder --force
```

`docker exec` ejecuta un comando dentro del contenedor de la API, que ya está corriendo.
`-e K6_USERS=50` es la variable que lee el seeder: cuántas cuentas crear. El seeder crea
`k6-0@carga.legrandhotel.test` … `k6-49@…`, todas recepcionistas y con la misma contraseña de
prueba. `--force` evita la pregunta de confirmación que artisan hace cuando cree estar en producción.

Hace falta porque `reservas.js` inicia sesión con esas cuentas: sin ellas la prueba se detiene de
entrada con un 401. `preparar.sh` no las crea, solo siembra los clientes del portal.

### 3. Los 1000 usuarios en un minuto

```bash
SALIDA=local-bloques-1000vu-1min bash tests/k6/dentro.sh reservas.js PROFILE=bloques VUS=1000 BLOCK_RAMP=1s BLOCK_HOLD=4s RAMP_DOWN=10s
```

| Trozo | Qué hace |
| --- | --- |
| `SALIDA=…` | Nombre de los resultados: `docs/pruebas/<nombre>.html` con gráficos y `.json` y `.txt` en `datos/` |
| `dentro.sh` | Lanza k6 **dentro de la red de Docker**, hablando con `http://nginx` en vez de `localhost:8000` |
| `reservas.js` | El escenario: cada usuario hace lo de un turno de recepción (70% consultas, 20% inicios de sesión, 10% reservas) |
| `PROFILE=bloques` | El perfil que sube la carga de 100 en 100 en vez de golpe |
| `VUS=1000` | Tope de usuarios simultáneos |
| `BLOCK_RAMP=1s` | Lo que tarda en entrar cada bloque |
| `BLOCK_HOLD=4s` | Lo que se sostiene antes del siguiente bloque |
| `RAMP_DOWN=10s` | Bajada al terminar |

La cuenta del minuto: 1000 ÷ 100 = **10 bloques**, cada uno de 1 + 4 = 5 s → 50 s, más 10 s de
bajada = **60 s**.

### 4. Los 5000 usuarios en un minuto

```bash
SALIDA=local-bloques-5000vu-1min bash tests/k6/dentro.sh reservas.js PROFILE=bloques VUS=5000 BLOCK_RAMP=500ms BLOCK_HOLD=500ms RAMP_DOWN=10s
```

Lo mismo con otros números: 5000 ÷ 100 = **50 bloques**, y para que quepan en el mismo minuto cada
uno dura 0,5 + 0,5 = 1 s → 50 s, más 10 s de bajada = **60 s**.

### 5. Devolver la API a la normalidad

```bash
bash tests/k6/restaurar.sh
```

Deshace lo del paso 1: devuelve `RATE_LIMIT_API=60`, `RATE_LIMIT_LOGIN=5` y `RATE_LIMIT_REGISTER=3`,
recrea el contenedor de la API y limpia la caché de configuración para que los lea, y comprueba que
responde 200. **No te lo saltes**: la web se quedaría aceptando 100.000 peticiones por minuto, o
sea sin protección contra fuerza bruta. Al revés también sirve de pista: si la web dice «Demasiadas
peticiones» sin motivo, suele ser que una prueba quedó a medias.

## Cómo cambiar la prueba

### Sin tocar el código, con variables

Todo lo que va después del nombre del script son variables (`CLAVE=valor`). Estas son las que
entiende cada escenario:

`reservas.js` (personal del hotel):

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `PROFILE` | `carga-25` | Qué forma tiene la carga: `bloques`, `escalon`, `aguante`, `estres`, `pico`, `resistencia` |
| `VUS` | según el perfil | Tope de usuarios simultáneos |
| `USERS` | 50 | Cuántas cuentas distintas se reparten entre los usuarios |
| `BLOCK` | 100 | Tamaño de cada bloque en el perfil `bloques` |
| `BLOCK_RAMP` | 10s | Lo que tarda en entrar cada bloque |
| `BLOCK_HOLD` | 20s | Lo que se sostiene cada bloque |
| `RAMP_DOWN` | 30s | Bajada final |
| `DURATION` | 45s | Duración del escalón en el perfil `escalon` |
| `HOLD` | 3m | Lo que se sostiene el tope en el perfil `aguante` |

`clientes-1000-reservas.js` (clientes del portal):

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `CLIENTES` | 50 | Cuántos clientes reservan a la vez |
| `RESERVAS` | 1000 | Cuántas reservas hay que completar (la prueba acaba al llegar) |
| `PAUSA` | 0 | Segundos entre una reserva y la siguiente; 6 imita a una persona real |
| `BUSCAR` | `cada-vez` | `una-vez` consulta los tipos al empezar y luego solo reserva: la mitad de peticiones |
| `MAX_DURATION` | 10m | Corta la prueba si se alarga |

Ejemplos:

```bash
# Que salga limpia: 600 usuarios es el techo sin errores de esta laptop
SALIDA=local-bloques-600vu bash tests/k6/dentro.sh reservas.js PROFILE=bloques VUS=600 BLOCK_RAMP=1s BLOCK_HOLD=4s RAMP_DOWN=10s

# Bloques de 50 en vez de 100, para ver el quiebre con más detalle
SALIDA=local-bloques-fino bash tests/k6/dentro.sh reservas.js PROFILE=bloques VUS=1000 BLOCK=50 BLOCK_RAMP=1s BLOCK_HOLD=2s

# Clientes del portal con pausa realista
SALIDA=local-clientes-pausa bash tests/k6/dentro.sh clientes-1000-reservas.js CLIENTES=50 RESERVAS=1000 PAUSA=6
```

### Tocando el código

| Qué quieres cambiar | Dónde |
| --- | --- |
| La mezcla de acciones (70% consultas, 20% login, 10% reservas) | `tests/k6/reservas.js`, en la función `export default`: los cortes `dice < 0.7` y `dice < 0.9` |
| Qué pantallas consulta cada usuario | `tests/k6/reservas.js`, el grupo `lecturas` |
| Las metas que deciden si la prueba pasa o falla | `tests/k6/reservas.js`, el `thresholds` de cada perfil (`p(95)<800`, `rate<0.01`) |
| Añadir un perfil nuevo | `tests/k6/reservas.js`, el objeto `profiles`: una clave más con sus `stages` |
| Los pasos de una reserva de cliente | `tests/k6/clientes-1000-reservas.js` |
| Qué prepara y restaura cada script | `tests/k6/preparar.sh` y `tests/k6/restaurar.sh` |
| Cómo se lanza k6 dentro de Docker | `tests/k6/dentro.sh` |

Un perfil es una lista de escalones: cada uno dice a cuántos usuarios llegar (`target`) y en cuánto
tiempo (`duration`). Por ejemplo, un perfil que sube a 2000 en 30 s, los sostiene 2 minutos y baja:

```js
mi_perfil: {
  stages: [
    { duration: '30s', target: VUS || 2000 },
    { duration: '2m', target: VUS || 2000 },
    { duration: '20s', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(95)<800'], http_req_failed: ['rate<0.01'] },
},
```

Se corre con `PROFILE=mi_perfil`. Si el nombre no existe, el script avisa al arrancar en vez de
correr una prueba equivocada.

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
