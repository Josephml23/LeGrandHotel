<?php

return [

    'version' => env('APP_VERSION', '1.0.0'),

    // Dominio del frontend: CORS y redirecciones de Google / verificación de correo.
    // FRONTEND_URL admite varios separados por coma (para CORS); usa App\Support\Frontend::url() para redirigir.
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    'rate_limits' => [
        'login' => (int) env('RATE_LIMIT_LOGIN', 5),
        'register' => (int) env('RATE_LIMIT_REGISTER', 3),
        'api' => (int) env('RATE_LIMIT_API', 60),
    ],

    'pagination' => [
        'default' => 15,
        'max' => 50,
    ],

];
