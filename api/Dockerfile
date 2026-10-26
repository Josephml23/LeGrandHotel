# syntax=docker/dockerfile:1.7
# Imagen de la API de LeGrandHotel: PHP 8.3-FPM con OPcache, Redis y MySQL.
# Uso: la misma imagen corre la API (php-fpm), el worker de colas y el scheduler.

FROM composer:2.8 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-req=ext-redis
COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

FROM php:8.3-fpm-alpine AS runtime

RUN apk add --no-cache icu-libs libzip mysql-client aws-cli \
 && apk add --no-cache --virtual .build $PHPIZE_DEPS icu-dev libzip-dev linux-headers \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql bcmath intl opcache pcntl zip \
 && pecl install redis \
 && docker-php-ext-enable redis \
 && apk del .build

COPY --from=vendor /app /var/www/html
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-legrandhotel.ini
COPY docker/fpm.conf /usr/local/etc/php-fpm.d/zz-legrandhotel.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint

WORKDIR /var/www/html
RUN chmod +x /usr/local/bin/entrypoint \
 && chown -R www-data:www-data storage bootstrap/cache \
 && rm -f .env

USER www-data
EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD php-fpm -t || exit 1

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]
