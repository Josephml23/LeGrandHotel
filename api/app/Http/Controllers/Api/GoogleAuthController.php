<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Throwable;

/**
 * Login con cuenta de Google (Socialite, modo stateless para la SPA).
 */
class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return $this->google()->redirect();
    }

    private function google(): GoogleProvider
    {
        $driver = Socialite::driver('google');
        if (! $driver instanceof GoogleProvider) {
            throw new \LogicException('El driver de Socialite "google" no está configurado.');
        }

        return $driver->stateless();
    }

    public function callback(): RedirectResponse
    {
        $frontend = rtrim(config('hotel.frontend_url'), '/');

        try {
            $googleUser = $this->google()->user();
        } catch (Throwable) {
            return redirect()->away("{$frontend}/login?error=google");
        }

        // Solo entra quien ya tiene una cuenta del personal: Google nunca crea cuentas nuevas.
        $user = User::where('google_id', $googleUser->getId())
            ->orWhere('email', $googleUser->getEmail())
            ->first();

        if (! $user || ! $user->hasRole(...Role::INTERNAL)) {
            return redirect()->away("{$frontend}/login?error=google_sin_cuenta");
        }

        $user = DB::transaction(function () use ($googleUser, $user) {
            if (! $user->google_id) {
                $user->forceFill(['google_id' => $googleUser->getId()])->save();
            }

            // Google ya verificó el correo.
            if (! $user->hasVerifiedEmail()) {
                $user->markEmailAsVerified();
            }

            return $user;
        });

        $token = AuthController::issueToken($user, 'google');

        // El token va en el fragmento (#): no se envía al servidor ni queda en logs de acceso.
        return redirect()->away("{$frontend}/auth/callback#token={$token['token']}&expires_at=".urlencode((string) $token['expires_at']));
    }
}
