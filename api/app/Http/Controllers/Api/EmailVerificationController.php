<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function send(Request $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return ApiResponse::success(['message' => 'El correo ya está verificado.']);
        }

        $request->user()->sendEmailVerificationNotification();

        return ApiResponse::success(['message' => 'Enlace de verificación enviado.']);
    }

    /**
     * Enlace firmado que llega por correo. La firma (middleware signed) protege la ruta,
     * así funciona aunque el usuario lo abra en otro navegador.
     */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::findOrFail($id);
        $frontend = rtrim(config('hotel.frontend_url'), '/');

        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return redirect()->away("{$frontend}/verify-email?status=invalid");
        }

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return redirect()->away("{$frontend}/verify-email?status=verified");
    }
}
