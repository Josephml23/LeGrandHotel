<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Espera creciente tras cada contraseña incorrecta: 30 s, 60 s, 2 min, 4 min… hasta 15 min.
 * Se cuenta por correo y equipo (IP); un ingreso correcto la reinicia y se olvida tras una hora sin intentos.
 */
class LoginLockout
{
    public const FIRST_WAIT = 30;

    public const MAX_WAIT = 900;

    /** Segundos que faltan para poder volver a intentar (0 si no está bloqueado). */
    public function remaining(string $email, string $ip): int
    {
        $until = Cache::get($this->key($email, $ip))['until'] ?? 0;

        return max(0, $until - now()->getTimestamp());
    }

    /** Registra un fallo y devuelve los segundos de espera que le tocan. */
    public function fail(string $email, string $ip): int
    {
        $key = $this->key($email, $ip);
        $fails = (Cache::get($key)['fails'] ?? 0) + 1;
        $wait = min(self::FIRST_WAIT * 2 ** ($fails - 1), self::MAX_WAIT);

        Cache::put($key, ['fails' => $fails, 'until' => now()->getTimestamp() + $wait], now()->addHour());

        return $wait;
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
