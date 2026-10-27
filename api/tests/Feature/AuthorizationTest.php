<?php

use App\Models\Role;

/*
 * Rutas protegidas contra acceso manual: cada rol solo entra a sus módulos.
 */

it('niega con 403 las rutas de otros roles', function (string $role, string $method, string $uri) {
    actingAsRole($role);

    expect($this->json($method, $uri))->toBeApiError(403, 'FORBIDDEN');
})->with([
    'recepcionista → personal' => [Role::RECEPTIONIST, 'GET', '/api/v1/staff'],
    'recepcionista → usuarios' => [Role::RECEPTIONIST, 'GET', '/api/v1/users'],
    'recepcionista → reportes' => [Role::RECEPTIONIST, 'GET', '/api/v1/reports/income'],
    'recepcionista → crear tipo' => [Role::RECEPTIONIST, 'POST', '/api/v1/room-types'],
    'recepcionista → inventario' => [Role::RECEPTIONIST, 'GET', '/api/v1/inventory-items'],
    'almacenero → habitaciones' => [Role::STOREKEEPER, 'GET', '/api/v1/rooms'],
    'almacenero → reservas' => [Role::STOREKEEPER, 'GET', '/api/v1/reservations'],
    'almacenero → clientes' => [Role::STOREKEEPER, 'GET', '/api/v1/clients'],
    'almacenero → cochera' => [Role::STOREKEEPER, 'GET', '/api/v1/parking-spots'],
    'almacenero → check-in' => [Role::STOREKEEPER, 'POST', '/api/v1/reservations/1/check-in'],
    'programador → reservas' => [Role::DEVELOPER, 'GET', '/api/v1/reservations'],
    'recepcionista → registrar usuario' => [Role::RECEPTIONIST, 'POST', '/api/v1/auth/register'],
]);

it('permite a cada rol sus módulos', function (string $role, string $uri) {
    actingAsRole($role);

    $this->getJson($uri)->assertOk()->assertJsonPath('success', true);
})->with([
    'admin → personal' => [Role::ADMIN, '/api/v1/staff'],
    'admin → reportes' => [Role::ADMIN, '/api/v1/reports/occupancy'],
    'recepcionista → habitaciones' => [Role::RECEPTIONIST, '/api/v1/rooms'],
    'recepcionista → tipos (lectura)' => [Role::RECEPTIONIST, '/api/v1/room-types'],
    'almacenero → inventario' => [Role::STOREKEEPER, '/api/v1/inventory-items'],
    'recepcionista → reservas' => [Role::RECEPTIONIST, '/api/v1/reservations'],
    'recepcionista → disponibles' => [Role::RECEPTIONIST, '/api/v1/rooms/available?from=2030-01-01&to=2030-01-03'],
    'todos → panel' => [Role::STOREKEEPER, '/api/v1/dashboard'],
]);
