<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Los primeros INTENTOS_LIBRES errores no penalizan: equivocarse al teclear es normal. A partir de
 * ahí la espera crece con cada fallo: 30 s, 60 s, 2 min, 4 min… hasta 15 min.
 * Se cuenta por correo y equipo (IP); un ingreso correcto la reinicia y se olvida tras una hora sin intentos.
 */
class LoginLockout
{
    /** Intentos que se permiten antes de empezar a hacer esperar. */
    public const FREE_ATTEMPTS = 3;

    public const FIRST_WAIT = 30;

    public const MAX_WAIT = 900;

    /** Segundos que faltan para poder volver a intentar (0 si no está bloqueado). */
    public function remaining(string $email, string $ip): int
    {
        $until = Cache::get($this->key($email, $ip))['until'] ?? 0;

        return max(0, $until - now()->getTimestamp());
    }

    /** Registra un fallo y devuelve los segundos de espera que le tocan (0 en los primeros). */
    public function fail(string $email, string $ip): int
    {
        $key = $this->key($email, $ip);
        $fails = (Cache::get($key)['fails'] ?? 0) + 1;

        // Los primeros intentos no cuestan espera: solo se anotan.
        $wait = $fails < self::FREE_ATTEMPTS
            ? 0
            : min(self::FIRST_WAIT * 2 ** ($fails - self::FREE_ATTEMPTS), self::MAX_WAIT);

        Cache::put($key, [
            'fails' => $fails,
            'until' => $wait > 0 ? now()->getTimestamp() + $wait : 0,
        ], now()->addHour());

        return $wait;
    }

    /** Intentos que quedan antes de que empiece la espera (0 cuando ya empezó). */
    public function attemptsLeft(string $email, string $ip): int
    {
        $fails = Cache::get($this->key($email, $ip))['fails'] ?? 0;

        return max(0, self::FREE_ATTEMPTS - $fails);
    }

    public function clear(string $email, string $ip): void
    {
        Cache::forget($this->key($email, $ip));
    }

    private function key(string $email, string $ip): string
    {
        return 'login-espera:'.sha1(Str::lower(trim($email)).'|'.$ip);
    }
}
