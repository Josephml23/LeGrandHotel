#!/bin/bash
# Corre reservas.js en bloques de 100 usuarios hasta VUS (1000 o 5000) y guarda:
#   docs/pruebas/local-bloques-<VUS>vu.html      gráficos (k6 web dashboard)
#   docs/pruebas/datos/local-bloques-<VUS>vu.*   resumen (.json, .txt) y cada petición (.csv.gz)
# Un vigilante detiene k6 si la memoria libre del equipo baja de MIN_FREE_MB (por defecto 400 MB),
# para no colgar la laptop; en ese caso queda anotado en el .txt en qué bloque se detuvo.
#   bash tests/k6/correr-bloques.sh 1000          → bloques de 30 s (10 s subiendo + 20 s sostenido)
#   bash tests/k6/correr-bloques.sh 1000 60       → bloques de 1 minuto (10 s subiendo + 50 s sostenido)
#   bash tests/k6/correr-bloques.sh 1000 5        → 1 minuto en total: 10 bloques de 5 s (1 s + 4 s) y 10 s de bajada
set -uo pipefail

VUS=${1:-1000}
BLOCK_SECONDS=${2:-30}
SUFFIX=$([ "$BLOCK_SECONDS" = 30 ] && echo "" || echo "-${BLOCK_SECONDS}s")
# Bloques cortos (menos de 30 s): 1 s para subir y bajada de 10 s; si no, 10 s para subir y bajada de 30 s.
if [ "$BLOCK_SECONDS" -lt 30 ]; then RAMP=1; RAMP_DOWN=10s; else RAMP=10; RAMP_DOWN=30s; fi
MIN_FREE_MB=${MIN_FREE_MB:-400}
BASE_URL=${BASE_URL:-http://localhost:8000/api/v1}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT="$ROOT/docs/pruebas/datos/local-bloques-${VUS}vu${SUFFIX}"
cd "$ROOT"

free_mb() { powershell -NoProfile -Command "[math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1KB)"; }

K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=-1 K6_WEB_DASHBOARD_EXPORT="docs/pruebas/local-bloques-${VUS}vu${SUFFIX}.html" \
  k6 run -e BASE_URL="$BASE_URL" -e PROFILE=bloques -e VUS="$VUS" -e BLOCK_RAMP="${RAMP}s" -e BLOCK_HOLD="$((BLOCK_SECONDS - RAMP))s" -e RAMP_DOWN="$RAMP_DOWN" \
  --summary-export="$OUT.json" --out csv="$OUT.csv.gz" tests/k6/reservas.js > "$OUT.txt" 2>&1 &
K6_PID=$!
START=$(date +%s)

while kill -0 "$K6_PID" 2>/dev/null; do
  free=$(free_mb | tr -d '\r')
  if [ -n "$free" ] && [ "$free" -lt "$MIN_FREE_MB" ]; then
    elapsed=$(( $(date +%s) - START ))
    echo "VIGILANTE: memoria libre ${free} MB < ${MIN_FREE_MB} MB a los ${elapsed} s; se detiene k6 (bloque ~$(( (elapsed / BLOCK_SECONDS + 1) * 100 )) VU)." | tee -a "$OUT.txt"
    taskkill //F //IM k6.exe > /dev/null 2>&1
    break
  fi
  sleep 5
done
wait "$K6_PID"
echo "k6 terminó (código $?). Resultados en $OUT.*"
