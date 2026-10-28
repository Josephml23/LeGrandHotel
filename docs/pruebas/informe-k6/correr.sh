#!/usr/bin/env bash
# Corre las 6 pruebas k6 del informe y guarda la salida de cada una (texto, resumen JSON y reporte HTML).
cd "$(dirname "$0")/../../.."
OUT=docs/pruebas/informe-k6/salidas
API=http://[::1]:8000/api/v1
run() { # nombre, comando...
  local name=$1; shift
  echo "### $name $(date +%H:%M:%S)"
  K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=$OUT/$name.html K6_WEB_DASHBOARD_PORT=-1 \
    "$@" --summary-export $OUT/$name.json > $OUT/$name.txt 2>&1
  echo "exit $?" >> $OUT/$name.txt
}
run 1-smoke       k6 run -e BASE_URL=$API -e VUS=5 -e DURATION=30s tests/k6/smoke.js
run 2-rate-limit  k6 run -e BASE_URL=http://[::1]:8001/api/v1 tests/k6/rate-limit.js
for v in 5 10 25 50; do
  run 3-escalon-${v}vu k6 run -e BASE_URL=$API -e PROFILE=escalon -e VUS=$v -e USERS=$v tests/k6/reservas.js
done
echo "### fin $(date +%H:%M:%S)"
