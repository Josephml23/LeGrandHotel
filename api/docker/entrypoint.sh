#!/bin/sh
# Prepara la app antes de arrancar php-fpm, el worker o el scheduler.
# En AWS las variables llegan desde SSM Parameter Store (ver infra/scripts/load-ssm-env.sh).
set -e

if [ "${APP_ENV:-production}" = "production" ]; then
  php artisan config:cache
  php artisan route:cache
  php artisan event:cache
fi

# Solo el contenedor marcado corre migraciones (evita carreras entre instancias).
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
fi

exec "$@"
