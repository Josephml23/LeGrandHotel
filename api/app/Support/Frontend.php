<?php

namespace App\Support;

/**
 * Dirección del frontend a la que la API devuelve al usuario (Google, verificación de correo).
 * FRONTEND_URL puede listar varios dominios separados por coma para CORS: se redirige al primero.
 */
class Frontend
{
    public static function url(string $path = ''): string
    {
        $first = trim(explode(',', (string) config('hotel.frontend_url'))[0]);

        return rtrim($first, '/').$path;
    }
}
