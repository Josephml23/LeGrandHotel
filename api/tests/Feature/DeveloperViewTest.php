<?php

use App\Models\Role;
use App\Services\RequestLogReader;

beforeEach(function () {
    $this->log = tempnam(sys_get_temp_dir(), 'lgh').'.json';
    $line = fn (array $ctx, string $message = 'request', int $level = 200) => json_encode([
        'message' => $message, 'context' => $ctx, 'level' => $level,
        'level_name' => $level >= 400 ? 'ERROR' : 'INFO', 'datetime' => '2026-10-27T10:00:00-05:00',
    ]);
    file_put_contents($this->log, implode("\n", [
        $line(['route' => 'api/v1/rooms', 'method' => 'GET', 'status' => 200, 'duration_ms' => 10]),
        $line(['route' => 'api/v1/rooms', 'method' => 'GET', 'status' => 200, 'duration_ms' => 30]),
        $line(['route' => 'api/v1/reservations', 'method' => 'POST', 'status' => 409, 'duration_ms' => 50]),
        $line(['route' => 'api/v1/reservations', 'method' => 'POST', 'status' => 500, 'duration_ms' => 400]),
        $line(['incident_id' => 'ABC123XYZ0', 'exception' => 'RuntimeException'], 'boom', 400),
    ])."\n");
    $this->app->instance(RequestLogReader::class, new RequestLogReader($this->log));
});

afterEach(fn () => @unlink($this->log));

it('solo programador y administrador entran a la vista del programador', function (string $role, int $status) {
    actingAsRole($role);

    $this->getJson('/api/v1/dev/overview')->assertStatus($status);
})->with([
    'programador' => [Role::DEVELOPER, 200],
    'administrador' => [Role::ADMIN, 200],
    'recepcionista' => [Role::RECEPTIONIST, 403],
    'almacenero' => [Role::STOREKEEPER, 403],
]);

it('muestra versión, drivers y conteos sin exponer secretos', function () {
    actingAsRole(Role::DEVELOPER);

    $response = $this->getJson('/api/v1/dev/overview')
        ->assertOk()
        ->assertJsonStructure(['data' => ['app' => ['version', 'php', 'laravel'], 'drivers' => ['database', 'cache'], 'security' => ['token_minutes', 'rate_limits_per_minute'], 'tables' => ['reservations']]]);

    expect($response->getContent())
        ->not->toContain((string) config('app.key'))
        ->not->toContain('password');
});

it('lista las rutas de la API con sus roles', function () {
    actingAsRole(Role::DEVELOPER);

    $routes = collect($this->getJson('/api/v1/dev/routes')->assertOk()->json('data'));
    $staff = $routes->firstWhere('uri', '/api/v1/staff');

    expect($staff['roles'])->toBe(['admin'])->and($staff['auth'])->toBeTrue();
    expect($routes->firstWhere('uri', '/api/v1/auth/login')['throttle'])->toBe('throttle:login');
});

it('resume las peticiones del log con percentiles y filtros', function () {
    actingAsRole(Role::DEVELOPER);

    $this->getJson('/api/v1/dev/requests')
        ->assertOk()
        ->assertJsonPath('data.summary.sampled', 4)
        ->assertJsonPath('data.summary.status.5xx', 1)
        ->assertJsonPath('data.summary.status.4xx', 1)
        ->assertJsonPath('data.summary.p95_ms', 400)
        ->assertJsonPath('data.summary.slowest_routes.0.route', 'POST /api/v1/reservations');

    $this->getJson('/api/v1/dev/requests?status=5xx')->assertOk()->assertJsonCount(1, 'data.requests');
});

it('encuentra un error por su código de incidente', function () {
    actingAsRole(Role::DEVELOPER);

    $this->getJson('/api/v1/dev/errors?incident=abc123xyz0')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.exception', 'RuntimeException');
});

it('calcula percentiles por rango más cercano', function () {
    expect(RequestLogReader::percentile([10, 20, 30, 40], 50))->toBe(20.0)
        ->and(RequestLogReader::percentile([10, 20, 30, 40], 95))->toBe(40.0)
        ->and(RequestLogReader::percentile([], 95))->toBe(0.0);
});
