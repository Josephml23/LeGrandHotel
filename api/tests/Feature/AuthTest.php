<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

$payload = fn (array $overrides = []) => [
    'name' => 'Ana Torres',
    'email' => 'ana@example.com',
    'password' => 'Secreta123',
    'password_confirmation' => 'Secreta123',
    'document_type' => 'DNI',
    'document_number' => '45678912',
    'phone' => '987111222',
    ...$overrides,
];

describe('registro', function () use ($payload) {
    it('crea un cliente con contraseña bcrypt y devuelve token', function () use ($payload) {
        Notification::fake();

        $this->postJson('/api/v1/auth/register', $payload())
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.roles', [Role::CLIENT])
            ->assertJsonPath('data.user.email_verified', false)
            ->assertJsonStructure(['data' => ['token', 'expires_at', 'user' => ['id', 'client_id']]]);

        $user = User::where('email', 'ana@example.com')->first();
        expect($user->password)->not->toBe('Secreta123')
            ->and($user->password)->toStartWith('$2y$')
            ->and(Hash::check('Secreta123', $user->password))->toBeTrue()
            ->and($user->client->document_number)->toBe('45678912');

        Notification::assertSentTo($user, VerifyEmail::class);
    });

    it('valida los datos con 422', function () use ($payload) {
        expect($this->postJson('/api/v1/auth/register', $payload(['email' => 'no-es-correo', 'password_confirmation' => 'otra'])))
            ->toBeApiError(422, 'VALIDATION_FAILED');
    });

    it('no permite correos repetidos', function () use ($payload) {
        User::factory()->create(['email' => 'ana@example.com']);

        $this->postJson('/api/v1/auth/register', $payload())
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['email']]]);
    });

    it('limita el registro a 3 por minuto (429 con Retry-After)', function () use ($payload) {
        foreach (range(1, 3) as $i) {
            $this->postJson('/api/v1/auth/register', $payload(['email' => "u{$i}@example.com", 'document_number' => "1000000{$i}"]))->assertCreated();
        }

        $response = $this->postJson('/api/v1/auth/register', $payload(['email' => 'u4@example.com', 'document_number' => '10000004']));
        expect($response)->toBeApiError(429, 'TOO_MANY_REQUESTS');
        $response->assertHeader('Retry-After');
    });
});

describe('login', function () {
    beforeEach(fn () => $this->user = User::factory()->withRole(Role::RECEPTIONIST)->create([
        'email' => 'recepcion@example.com',
        'password' => 'Secreta123',
    ]));

    it('inicia sesión con credenciales válidas', function () {
        $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'Secreta123'])
            ->assertOk()
            ->assertJsonPath('data.user.roles', [Role::RECEPTIONIST])
            ->assertJsonPath('data.token_type', 'Bearer');
    });

    it('rechaza credenciales incorrectas con 401', function () {
        expect($this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala']))
            ->toBeApiError(401, 'INVALID_CREDENTIALS');
    });

    it('limita el login a 5 intentos por minuto', function () {
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala'])->assertStatus(401);
        }

        expect($this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala']))
            ->toBeApiError(429, 'TOO_MANY_REQUESTS');
    });
});

describe('tokens', function () {
    it('responde 401 sin token', function () {
        expect($this->getJson('/api/v1/auth/me'))->toBeApiError(401, 'UNAUTHENTICATED');
    });

    it('responde 401 con un token vencido', function () {
        $user = User::factory()->withRole(Role::ADMIN)->create();
        $token = $user->createToken('web', ['*'], now()->subMinute())->plainTextToken;

        expect($this->withToken($token)->getJson('/api/v1/auth/me'))->toBeApiError(401, 'UNAUTHENTICATED');
    });

    it('refresh emite un token nuevo y revoca el anterior', function () {
        $user = User::factory()->withRole(Role::ADMIN)->create();
        $old = $user->createToken('web', ['*'], now()->addMinutes(5))->plainTextToken;

        $new = $this->withToken($old)->postJson('/api/v1/auth/refresh')->assertOk()->json('data.token');

        expect($new)->not->toBe($old)->and($user->tokens()->count())->toBe(1);
        $this->app['auth']->forgetGuards();
        $this->withToken($old)->getJson('/api/v1/auth/me')->assertStatus(401);
        $this->app['auth']->forgetGuards();
        $this->withToken($new)->getJson('/api/v1/auth/me')->assertOk();
    });

    it('logout revoca el token actual', function () {
        $user = User::factory()->withRole(Role::ADMIN)->create();
        $token = $user->createToken('web')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();
        expect($user->tokens()->count())->toBe(0);
    });
});

describe('verificación de correo', function () {
    it('verifica con el enlace firmado y redirige al frontend', function () {
        $user = User::factory()->unverified()->withRole(Role::CLIENT)->create();
        $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);

        $this->get($url)->assertRedirectContains('/verify-email?status=verified');
        expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
    });

    it('rechaza enlaces sin firma con 403', function () {
        $user = User::factory()->unverified()->create();

        expect($this->getJson("/api/v1/email/verify/{$user->id}/".sha1($user->email)))->toBeApiError(403);
    });
});
