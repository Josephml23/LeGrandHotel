#!/usr/bin/env bash
# Escalones de 5, 10, 25 y 50 clientes en el portal (tests/k6/portal.js). Antes: LoadTestClientsSeeder.
# Guarda la salida de cada corrida (texto, resumen JSON y reporte HTML) en salidas/4-clientes-*.
cd "$(dirname "$0")/../../.."
OUT=docs/pruebas/informe-k6/salidas
API=${BASE_URL:-http://[::1]:8000/api/v1}
for v in 5 10 25 50; do
  echo "### 4-clientes-${v}vu $(date +%H:%M:%S)"
  K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=$OUT/4-clientes-${v}vu.html K6_WEB_DASHBOARD_PORT=-1 \
    k6 run -e BASE_URL=$API -e VUS=$v --summary-export $OUT/4-clientes-${v}vu.json tests/k6/portal.js > $OUT/4-clientes-${v}vu.txt 2>&1
  echo "exit $?" >> $OUT/4-clientes-${v}vu.txt
done
echo "### fin $(date +%H:%M:%S)"
