<?php

use App\Models\Role;
use App\Models\RoomType;
use Illuminate\Support\Facades\Route;

it('health responde 200 con el estado de la app, BD y caché', function () {
    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertJsonPath('data.status', 'ok')
        ->assertJsonPath('data.checks.database.status', 'ok')
        ->assertJsonPath('data.checks.cache.status', 'ok');
});

it('responde 404 en JSON para rutas inexistentes', function () {
    expect($this->getJson('/api/v1/no-existe'))->toBeApiError(404, 'ROUTE_NOT_FOUND');
});

it('responde 404 con código del recurso cuando el id no existe', function () {
    actingAsRole(Role::ADMIN);

    expect($this->getJson('/api/v1/rooms/999999'))->toBeApiError(404, 'ROOM_NOT_FOUND');
});

it('responde 400 si el JSON está mal formado', function () {
    actingAsRole(Role::ADMIN);

    $response = $this->call('POST', '/api/v1/room-types', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/json',
    ], '{"name": "Suite",');

    expect($response)->toBeApiError(400, 'BAD_REQUEST');
});

it('responde 500 sin trazas y con código de incidente', function () {
    config(['app.debug' => false]);
    Route::get('/api/v1/_boom', fn () => throw new RuntimeException('secreto interno'));

    $response = $this->getJson('/api/v1/_boom');

    expect($response)->toBeApiError(500, 'INTERNAL_ERROR');
    $response->assertJsonStructure(['error' => ['details' => ['incident_id']]]);
    expect($response->getContent())->not->toContain('secreto interno')->not->toContain('trace');
});

it('limita la API a 60 peticiones por minuto por usuario', function () {
    config(['hotel.rate_limits.api' => 3]);
    actingAsRole(Role::ADMIN);

    foreach (range(1, 3) as $_) {
        $this->getJson('/api/v1/room-types')->assertOk();
    }

    expect($this->getJson('/api/v1/room-types'))->toBeApiError(429);
});

it('agrega cabeceras de seguridad e id de petición', function () {
    $this->getJson('/api/v1/health')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Request-Id');
});

it('CORS solo autoriza el dominio del frontend', function () {
    $allowed = config('cors.allowed_origins')[0];

    $this->withHeaders(['Origin' => $allowed])->getJson('/api/v1/health')
        ->assertHeader('Access-Control-Allow-Origin', $allowed);

    // El navegador bloquea la respuesta porque la cabecera no coincide con el origen que la pidió.
    $response = $this->withHeaders(['Origin' => 'https://sitio-malicioso.com'])->getJson('/api/v1/health');
    expect($response->headers->get('Access-Control-Allow-Origin'))->not->toBe('https://sitio-malicioso.com')->not->toBe('*');
});

it('pagina con meta y respeta el máximo de 50 por página', function () {
    actingAsRole(Role::ADMIN);
    RoomType::factory()->count(60)->create();

    $this->getJson('/api/v1/room-types?per_page=500&page=1')
        ->assertOk()
        ->assertJsonPath('meta.per_page', 50)
        ->assertJsonPath('meta.total', 60)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonCount(50, 'data');
});

it('registra creación, edición y eliminación en audit_logs', function () {
    $admin = actingAsRole(Role::ADMIN);

    $id = $this->postJson('/api/v1/room-types', ['name' => 'Suite', 'capacity' => 2, 'price_per_night' => 300])->json('data.id');
    $this->putJson("/api/v1/room-types/{$id}", ['price_per_night' => 320]);
    $this->deleteJson("/api/v1/room-types/{$id}");

    $this->assertDatabaseHas('audit_logs', ['entity' => 'room_type', 'entity_id' => $id, 'action' => 'created', 'user_id' => $admin->id]);
    $this->assertDatabaseHas('audit_logs', ['entity' => 'room_type', 'entity_id' => $id, 'action' => 'updated']);
    $this->assertDatabaseHas('audit_logs', ['entity' => 'room_type', 'entity_id' => $id, 'action' => 'deleted']);
});
