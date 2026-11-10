<?php

/**
 * Una línea vacía en .env (RATE_LIMIT_API=) no debe dejar el límite en 0: con 0 toda la API responde 429.
 */
it('usa los límites por defecto si las variables están vacías', function () {
    $names = ['RATE_LIMIT_LOGIN', 'RATE_LIMIT_REGISTER', 'RATE_LIMIT_API'];
    $before = array_map(fn ($name) => getenv($name), $names);

    try {
        foreach ($names as $name) {
            putenv("{$name}=");
            $_ENV[$name] = $_SERVER[$name] = '';
        }

        $config = require base_path('config/hotel.php');

        expect($config['rate_limits'])->toBe(['login' => 5, 'register' => 3, 'api' => 60]);
    } finally {
        foreach ($names as $i => $name) {
            $before[$i] === false ? putenv($name) : putenv("{$name}={$before[$i]}");
            unset($_ENV[$name], $_SERVER[$name]);
        }
    }
});
