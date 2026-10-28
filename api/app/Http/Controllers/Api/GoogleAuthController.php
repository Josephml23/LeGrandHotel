<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Support\Frontend;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Throwable;

/**
 * Registro e inicio de sesión de clientes con Google (Socialite, modo stateless para la SPA).
 * Las cuentas del personal no pueden usar Google.
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
        $frontend = Frontend::url();

        try {
            $googleUser = $this->google()->user();
        } catch (Throwable) {
            return redirect()->away("{$frontend}/login?error=google");
        }

        $user = User::where('google_id', $googleUser->getId())
            ->orWhere('email', $googleUser->getEmail())
            ->first();

        // Google es solo para clientes: el personal entra con su correo y contraseña.
        if ($user && ! $user->hasRole(Role::CLIENT)) {
            return redirect()->away("{$frontend}/login?error=google_personal");
        }

        $user = DB::transaction(function () use ($googleUser, $user) {
            if (! $user) {
                // Primera vez: se crea la cuenta de cliente. El DNI y el teléfono los completa en /completar-registro.
                $user = User::create([
                    'name' => $googleUser->getName() ?: $googleUser->getEmail(),
                    'email' => $googleUser->getEmail(),
                ]);
                $user->forceFill(['google_id' => $googleUser->getId()])->save();
                $user->assignRole(Role::CLIENT);
            }

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
