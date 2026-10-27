<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Role;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Registro interno: el Administrador crea la cuenta de una persona del hotel con su rol.
     * No inicia sesión por ella; la persona recibe el correo de verificación y entra con su contraseña.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
            ]);
            $user->assignRole($data['role']);

            return $user;
        });

        event(new Registered($user));

        return ApiResponse::created(self::userPayloadFor($user));
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email'))->first();

        if (! $user || ! $user->password || ! Hash::check($request->string('password'), $user->password)) {
            throw new ApiException('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.', 401);
        }

        // Solo el personal del hotel entra: una cuenta sin rol interno no recibe token.
        if (! $user->hasRole(...Role::INTERNAL)) {
            throw new ApiException('ACCOUNT_WITHOUT_ACCESS', 'Esta cuenta no tiene acceso al sistema del hotel.', 403);
        }

        return ApiResponse::success($this->tokenPayload($user, $request->input('device_name', 'web')));
    }

    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success($this->userPayload($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return ApiResponse::noContent();
    }

    /** Emite un token nuevo y revoca el actual (el frontend lo llama antes de que venza). */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        $current = $user->currentAccessToken();
        $payload = $this->tokenPayload($user, $current->name ?? 'web');
        $current->delete();

        return ApiResponse::success($payload);
    }

    public static function issueToken(User $user, string $device): array
    {
        $minutes = (int) config('sanctum.expiration');
        $expiresAt = $minutes > 0 ? now()->addMinutes($minutes) : null;
        $token = $user->createToken($device, ['*'], $expiresAt);

        return [
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $expiresAt?->toIso8601String(),
        ];
    }

    private function tokenPayload(User $user, string $device): array
    {
        return [...self::issueToken($user, $device), 'user' => $this->userPayload($user)];
    }

    public static function userPayloadFor(User $user): array
    {
        $user->loadMissing('roles');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'email_verified' => $user->hasVerifiedEmail(),
            'roles' => $user->roles->pluck('name')->values(),
        ];
    }

    private function userPayload(User $user): array
    {
        return self::userPayloadFor($user);
    }
}
