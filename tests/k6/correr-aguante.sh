#!/bin/bash
# Prueba de aguante: llega a VUS usuarios en 1 minuto (bloques de 100) y los sostiene HOLD (3 min por defecto).
# Mide cuánto tiempo responde sin errores y, al terminar, si la API se recupera sola.
#   bash tests/k6/correr-aguante.sh 1000
# Deja docs/pruebas/local-aguante-<VUS>vu.html y docs/pruebas/datos/local-aguante-<VUS>vu.* (.json, .txt, .csv.gz);
# la tabla por tramos de 10 s sale con: python docs/pruebas/aguante.py 1000
set -uo pipefail

VUS=${1:-1000}
HOLD=${HOLD:-3m}
MIN_FREE_MB=${MIN_FREE_MB:-400}
BASE_URL=${BASE_URL:-http://localhost:8000/api/v1}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT="$ROOT/docs/pruebas/datos/local-aguante-${VUS}vu"
cd "$ROOT"

free_mb() { powershell -NoProfile -Command "[math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1KB)"; }

K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=-1 K6_WEB_DASHBOARD_EXPORT="docs/pruebas/local-aguante-${VUS}vu.html" \
  k6 run -e BASE_URL="$BASE_URL" -e PROFILE=aguante -e VUS="$VUS" -e HOLD="$HOLD" \
  --summary-export="$OUT.json" --out csv="$OUT.csv.gz" tests/k6/reservas.js > "$OUT.txt" 2>&1 &
K6_PID=$!
START=$(date +%s)

while kill -0 "$K6_PID" 2>/dev/null; do
  free=$(free_mb | tr -d '\r')
  if [ -n "$free" ] && [ "$free" -lt "$MIN_FREE_MB" ]; then
    echo "VIGILANTE: memoria libre ${free} MB < ${MIN_FREE_MB} MB a los $(( $(date +%s) - START )) s; se detiene k6." | tee -a "$OUT.txt"
    taskkill //F //IM k6.exe > /dev/null 2>&1
    break
  fi
  sleep 5
done
wait "$K6_PID"
echo "k6 terminó (código $?)."

# Recuperación: /health cada 5 s durante 1 minuto después de la prueba.
{
  echo "RECUPERACIÓN (/health cada 5 s después de la prueba):"
  END=$(date +%s)
  for i in $(seq 0 12); do
    result=$(curl -s -o /dev/null -m 15 -w '%{http_code} %{time_total}s' "$BASE_URL/health")
    echo "  +$(( $(date +%s) - END ))s $result"
    sleep 5
  done
} | tee -a "$OUT.txt"
