#!/bin/bash
# Corre una prueba de k6 DENTRO de la red de Docker, hablando con Nginx directamente
# (http://nginx) en vez de pasar por localhost:8000.
#
# ¿Por qué? En Windows, Docker Desktop publica localhost:8000 con un proxy propio. Ese proxy
# aguanta unos cientos de conexiones a la vez; con 500 clientes de golpe rechaza la mayoría
# ("connection refused") y la prueba mide el proxy de Windows, no la API. Desde dentro de la red
# de Docker no existe ese intermediario: 0 conexiones rechazadas.
#
# Uso:
#   bash tests/k6/dentro.sh clientes-1000-reservas.js CLIENTES=50 RESERVAS=1000 BUSCAR=una-vez
#   SALIDA=local-bloques-5000vu bash tests/k6/dentro.sh reservas.js PROFILE=bloques VUS=5000
#
# El primer argumento es el script de tests/k6/; los demás son variables para k6 (CLAVE=valor).
# Con SALIDA=<nombre> además guarda:
#   docs/pruebas/<nombre>.html        gráficos (k6 web dashboard)
#   docs/pruebas/datos/<nombre>.json  resumen de métricas
#   docs/pruebas/datos/<nombre>.txt   salida completa de la corrida
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT=${1:-clientes-1000-reservas.js}
shift || true
SALIDA=${SALIDA:-}

if [ ! -f "$ROOT/tests/k6/$SCRIPT" ]; then
  echo "No existe tests/k6/$SCRIPT" >&2
  exit 1
fi

# La red que crea docker compose se llama <carpeta>_default.
RED=$(docker network ls --format '{{.Name}}' | grep -E '_default$' | grep -i legrandhotel | head -1)
if [ -z "$RED" ]; then
  echo "No encuentro la red de Docker. Enciende el stack primero: bash tests/k6/preparar.sh" >&2
  exit 1
fi

# Cada CLAVE=valor se pasa como -e CLAVE=valor.
ENVS=()
for par in "$@"; do ENVS+=(-e "$par"); done

# Con SALIDA: reporte HTML y resumen JSON dentro de docs/pruebas/ (rutas vistas desde el contenedor).
EXTRA=()
DASH=()
TXT=/dev/stdout
if [ -n "$SALIDA" ]; then
  mkdir -p "$ROOT/docs/pruebas/datos"
  EXTRA=(--summary-export "/proyecto/docs/pruebas/datos/$SALIDA.json")
  DASH=(-e K6_WEB_DASHBOARD=true -e K6_WEB_DASHBOARD_PORT=-1 \
        -e "K6_WEB_DASHBOARD_EXPORT=/proyecto/docs/pruebas/$SALIDA.html")
  TXT="$ROOT/docs/pruebas/datos/$SALIDA.txt"
fi

echo "Red: $RED   Script: $SCRIPT"
echo "La API se ve como http://nginx/api/v1 (sin pasar por Windows)."
[ -n "$SALIDA" ] && echo "Resultados en docs/pruebas/$SALIDA.{html,…} y docs/pruebas/datos/$SALIDA.{json,txt}"
echo

# MSYS_NO_PATHCONV=1: Git Bash convierte /proyecto en una ruta de Windows y Docker la rechaza.
MSYS_NO_PATHCONV=1 docker run --rm \
  --network "$RED" \
  -v "$ROOT:/proyecto" \
  -w /proyecto \
  "${DASH[@]}" \
  grafana/k6:latest run \
  -e BASE_URL=http://nginx/api/v1 \
  "${ENVS[@]}" \
  "${EXTRA[@]}" \
  "/proyecto/tests/k6/$SCRIPT" 2>&1 | tee "$TXT"
