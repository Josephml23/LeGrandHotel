<?php

return [

    'version' => env('APP_VERSION', '1.0.0'),

    // Dominio del frontend: CORS y redirecciones de Google / verificación de correo.
    // FRONTEND_URL admite varios separados por coma (para CORS); usa App\Support\Frontend::url() para redirigir.
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    /*
     * Dónde está corriendo la API. Render publica estas variables en cada servicio; en AWS y en
     * local quedan vacías. Va aquí y no en el controlador porque en producción la configuración
     * se cachea (config:cache) y env() devolvería null fuera de este directorio.
     */
    'deploy' => [
        'platform' => env('RENDER') ? 'Render' : (env('AWS_EXECUTION_ENV') ? 'AWS' : 'Local'),
        'service' => env('RENDER_SERVICE_NAME'),
        'url' => env('RENDER_EXTERNAL_URL') ?: env('APP_URL'),
        'commit' => substr((string) env('RENDER_GIT_COMMIT'), 0, 7) ?: null,
        'branch' => env('RENDER_GIT_BRANCH'),
    ],

    // «?:» y no el valor por defecto de env(): una línea vacía (RATE_LIMIT_API=) daría límite 0 y todo respondería 429.
    'rate_limits' => [
        'login' => (int) (env('RATE_LIMIT_LOGIN') ?: 5),
        'register' => (int) (env('RATE_LIMIT_REGISTER') ?: 3),
        'api' => (int) (env('RATE_LIMIT_API') ?: 60),
    ],

    'pagination' => [
        'default' => 15,
        'max' => 50,
    ],

];
