<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

$payload = fn (array $overrides = []) => [
    'name' => 'Ana Torres',
    'email' => 'ana@legrandhotel.pe',
    'password' => 'Secreta123',
    'password_confirmation' => 'Secreta123',
    'role' => Role::RECEPTIONIST,
    ...$overrides,
];

describe('registro interno (solo el Administrador)', function () use ($payload) {
    it('el administrador registra una cuenta del personal con contraseña bcrypt', function () use ($payload) {
        Notification::fake();
        actingAsRole(Role::ADMIN);

        $this->postJson('/api/v1/auth/register', $payload())
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.roles', [Role::RECEPTIONIST])
            ->assertJsonPath('data.email_verified', false)
            ->assertJsonMissingPath('data.token'); // registrar a alguien no inicia sesión por esa persona

        $user = User::where('email', 'ana@legrandhotel.pe')->first();
        expect($user->password)->not->toBe('Secreta123')
            ->and($user->password)->toStartWith('$2y$')
            ->and(Hash::check('Secreta123', $user->password))->toBeTrue();

        Notification::assertSentTo($user, VerifyEmail::class);
    });

    it('nadie de afuera puede registrarse (401 sin sesión)', function () use ($payload) {
        expect($this->postJson('/api/v1/auth/register', $payload()))->toBeApiError(401, 'UNAUTHENTICATED');
        $this->assertDatabaseMissing('users', ['email' => 'ana@legrandhotel.pe']);
    });

    it('solo el administrador registra: recepción recibe 403', function () use ($payload) {
        actingAsRole(Role::RECEPTIONIST);

        expect($this->postJson('/api/v1/auth/register', $payload()))->toBeApiError(403, 'FORBIDDEN');
    });

    it('solo acepta roles internos del hotel', function () use ($payload) {
        actingAsRole(Role::ADMIN);

        $this->postJson('/api/v1/auth/register', $payload(['role' => 'client']))
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['role']]]);
    });

    it('valida los datos con 422 y no permite correos repetidos', function () use ($payload) {
        actingAsRole(Role::ADMIN);
        User::factory()->create(['email' => 'ana@legrandhotel.pe']);

        expect($this->postJson('/api/v1/auth/register', $payload(['password_confirmation' => 'otra'])))
            ->toBeApiError(422, 'VALIDATION_FAILED');
        $this->postJson('/api/v1/auth/register', $payload())
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['email']]]);
    });

    it('limita el registro a 3 por minuto (429 con Retry-After)', function () use ($payload) {
        actingAsRole(Role::ADMIN);
        foreach (range(1, 3) as $i) {
            $this->postJson('/api/v1/auth/register', $payload(['email' => "u{$i}@legrandhotel.pe"]))->assertCreated();
        }

        $response = $this->postJson('/api/v1/auth/register', $payload(['email' => 'u4@legrandhotel.pe']));
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

    it('una cuenta sin rol del hotel no puede entrar (403)', function () {
        User::factory()->create(['email' => 'externo@example.com', 'password' => 'Secreta123']);

        expect($this->postJson('/api/v1/auth/login', ['email' => 'externo@example.com', 'password' => 'Secreta123']))
            ->toBeApiError(403, 'ACCOUNT_WITHOUT_ACCESS');
    });

    it('tras una contraseña incorrecta hace esperar 30 segundos', function () {
        $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala'])
            ->assertStatus(401)
            ->assertJsonPath('error.details.retry_after', 30);

        $response = $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'Secreta123']);
        expect($response)->toBeApiError(429, 'LOGIN_LOCKED');
        $response->assertHeader('Retry-After', 30);
    });

    it('la espera sube con cada fallo: 30 s, 1 min, 2 min…', function () {
        $login = fn () => $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala']);

        $login()->assertJsonPath('error.details.retry_after', 30);
        $this->travel(31)->seconds();
        $login()->assertJsonPath('error.details.retry_after', 60);
        $this->travel(61)->seconds();
        $login()->assertJsonPath('error.details.retry_after', 120);
        $this->travel(30)->seconds();
        $login()->assertStatus(429)->assertJsonPath('error.details.retry_after', 90);
    });

    it('un ingreso correcto reinicia la espera', function () {
        $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala']);
        $this->travel(31)->seconds();
        $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'Secreta123'])->assertOk();

        $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala'])
            ->assertJsonPath('error.details.retry_after', 30);
    });

    it('avisa la espera en inglés si se pide', function () {
        $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala'], ['Accept-Language' => 'en'])
            ->assertJsonPath('error.message', 'Incorrect email or password.');

        $this->postJson('/api/v1/auth/login', ['email' => 'recepcion@example.com', 'password' => 'mala'], ['Accept-Language' => 'en'])
            ->assertJsonPath('error.message', 'Too many failed attempts. Try again in 30 seconds.');
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
        $user = User::factory()->unverified()->withRole(Role::RECEPTIONIST)->create();
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
