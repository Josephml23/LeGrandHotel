#!/bin/sh
# Arranque de la API en Render: prepara la configuración y levanta PHP-FPM y Nginx en el mismo contenedor.
# Las plantillas de /etc son de solo lectura (el contenedor corre como www-data): se arman en /tmp.
set -e

sed "s/__PORT__/${PORT:-10000}/" /etc/nginx/nginx.conf.template > /tmp/nginx.conf
sed "s/__WORKERS__/${PHP_FPM_WORKERS:-5}/" /usr/local/etc/php-fpm.render.conf > /tmp/php-fpm.conf

# Render publica la dirección del servicio en RENDER_EXTERNAL_URL; Laravel la necesita en APP_URL
# para armar los enlaces de verificación de correo y el regreso de Google.
if [ -z "${APP_URL:-}" ] && [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
  export APP_URL="$RENDER_EXTERNAL_URL"
fi

# Cachés de Laravel: el contenedor es inmutable, así que se arman una vez al arrancar.
php artisan config:cache
php artisan route:cache
php artisan event:cache

# Migraciones: solo si se pide (RUN_MIGRATIONS=true), para no correrlas en cada reinicio.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
fi

# Datos de demostración (roles, cuentas, habitaciones, cochera e inventario). El plan gratuito de Render
# no da consola, así que la única forma de sembrarlos es desde aquí: pon RUN_SEED=true, espera el
# despliegue y vuelve a ponerlo en false. DemoSeeder es idempotente: repetirlo no duplica nada.
if [ "${RUN_SEED:-false}" = "true" ]; then
  php artisan db:seed --force
fi

php-fpm -y /tmp/php-fpm.conf -D
# -p fija el prefijo (rutas relativas de Nginx) y -e manda a la salida estándar los errores de arranque,
# que ocurren antes de leer el error_log de la configuración.
exec nginx -p /etc/nginx -c /tmp/nginx.conf -e /dev/stderr -g 'daemon off;'
