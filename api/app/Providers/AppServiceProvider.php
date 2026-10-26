<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->configureRateLimits();
    }

    /**
     * Login 5/min por IP+correo, registro 3/min por IP y API 60/min por usuario.
     * Los límites se leen de config/hotel.php para poder subirlos en pruebas de carga.
     */
    private function configureRateLimits(): void
    {
        // Al superar el límite se lanza ThrottleRequestsException y ApiExceptionRenderer responde 429 con Retry-After.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(config('hotel.rate_limits.login'))
            ->by(Str::lower((string) $request->input('email')).'|'.$request->ip()));

        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(config('hotel.rate_limits.register'))
            ->by($request->ip()));

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(config('hotel.rate_limits.api'))
            ->by($request->user()?->id ?: $request->ip()));
    }
}
