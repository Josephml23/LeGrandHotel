#!/bin/bash
# Deja la API lista para una prueba de carga: enciende los contenedores, sube los límites de
# peticiones (si no, los 429 cuentan como errores), cachea la configuración y siembra los clientes.
#
#   bash tests/k6/preparar.sh 50              → 50 clientes de prueba
#   bash tests/k6/preparar.sh 50 --limpiar    → además borra lo que dejaron las pruebas anteriores
#
# Usa --limpiar cuando las reservas de prueba acumuladas llenen el calendario: con el hotel lleno,
# las reservas nuevas chocan y los resultados dejan de medir el sistema.
# Al terminar la prueba: bash tests/k6/restaurar.sh
set -euo pipefail

CLIENTES=${1:-50}
LIMPIAR=${2:-}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENV_FILE="$ROOT/api/.env"
cd "$ROOT"

echo "1/5  Encendiendo los contenedores…"
docker compose up -d mysql redis app nginx >/dev/null

if [ "$LIMPIAR" = "--limpiar" ]; then
  echo "2/5  Borrando las reservas y cuentas que dejaron las pruebas anteriores…"
  docker exec legrandhotel-app-1 php artisan k6:limpiar --masivos
  docker exec legrandhotel-app-1 php artisan db:seed --class=MassiveDataSeeder --force >/dev/null
  echo "     Datos de prueba recreados."
else
  echo "2/5  Sin limpiar (añade --limpiar si el calendario ya está lleno)."
fi

echo "3/5  Subiendo los límites de peticiones solo para la prueba…"
sed -i -E 's/^RATE_LIMIT_(API|LOGIN|REGISTER)=.*$/RATE_LIMIT_\1=100000/' "$ENV_FILE"
docker compose up -d --force-recreate app >/dev/null

echo "4/5  Sembrando $CLIENTES clientes de prueba…"
(cd api && K6_CLIENTS="$CLIENTES" php artisan db:seed --class=LoadTestClientsSeeder --force | tail -1)

echo "5/5  Cacheando la configuración y calentando la API…"
docker exec legrandhotel-app-1 sh -c 'php artisan config:cache >/dev/null && php artisan route:cache >/dev/null && php artisan event:cache >/dev/null'
docker restart legrandhotel-app-1 >/dev/null
sleep 12
for _ in 1 2 3; do curl -s -o /dev/null -m 60 "http://localhost:8000/api/v1/health" || true; done
estado=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "http://localhost:8000/api/v1/health")

echo
if [ "$estado" = "200" ]; then
  echo "Listo. La API responde y hay $CLIENTES clientes de prueba."
  echo "Ahora corre la prueba, por ejemplo:"
  echo "  k6 run -e BASE_URL=http://localhost:8000/api/v1 -e CLIENTES=$CLIENTES -e RESERVAS=5000 -e BUSCAR=una-vez tests/k6/clientes-1000-reservas.js"
else
  echo "La API respondió $estado. Espera unos segundos y vuelve a probar: curl http://localhost:8000/api/v1/health"
fi
