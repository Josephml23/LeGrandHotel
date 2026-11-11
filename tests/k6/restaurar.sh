#!/bin/bash
# Devuelve la API a su configuración normal después de una prueba de carga: baja los límites de
# peticiones a los de siempre y quita la caché de configuración.
#   bash tests/k6/restaurar.sh
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENV_FILE="$ROOT/api/.env"
cd "$ROOT"

echo "1/3  Bajando los límites de peticiones a los normales…"
sed -i -E 's/^RATE_LIMIT_API=.*$/RATE_LIMIT_API=60/; s/^RATE_LIMIT_LOGIN=.*$/RATE_LIMIT_LOGIN=5/; s/^RATE_LIMIT_REGISTER=.*$/RATE_LIMIT_REGISTER=3/' "$ENV_FILE"

echo "2/3  Recreando la API sin caché de configuración…"
docker compose up -d --force-recreate app >/dev/null
docker exec legrandhotel-app-1 php artisan optimize:clear >/dev/null
sleep 8

echo "3/3  Calentando y comprobando…"
# La primera petición tras reiniciar PHP-FPM tarda y puede dar 503: se descarta.
for _ in 1 2 3; do curl -s -o /dev/null -m 60 "http://localhost:8000/api/v1/health" || true; done
estado=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "http://localhost:8000/api/v1/health")
grep -E '^RATE_LIMIT_' "$ENV_FILE"
echo "La API responde $estado."
