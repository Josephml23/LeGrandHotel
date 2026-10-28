<?php

use App\Models\Role;
use App\Models\Staff;
use App\Models\User;

/*
 * Solo existe un Programador: nadie crea otro ni le da ese rol a una cuenta,
 * y el que existe no pierde su rol ni se elimina desde la aplicación.
 */
beforeEach(function () {
    $this->developer = User::factory()->withRole(Role::DEVELOPER)->create();
    actingAsRole(Role::ADMIN);
});

it('no crea un Programador desde Usuarios ni desde Personal', function () {
    $this->postJson('/api/v1/users', ['name' => 'Otro', 'email' => 'otro@hotel.test', 'password' => 'Clave1234', 'roles' => [Role::DEVELOPER]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['roles.0'], 'error.details');

    $this->postJson('/api/v1/staff', [
        'name' => 'Otro', 'email' => 'otro@hotel.test', 'password' => 'Clave1234',
        'role' => Role::DEVELOPER, 'position' => 'Soporte', 'shift' => 'morning', 'hired_at' => '2024-03-01',
    ])->assertUnprocessable()->assertJsonValidationErrors(['role'], 'error.details');
});

it('no le da el rol de Programador a otra cuenta', function () {
    $user = User::factory()->withRole(Role::RECEPTIONIST)->create();
    $staff = Staff::create(['user_id' => $user->id, 'position' => 'Recepción', 'shift' => 'morning', 'hired_at' => '2024-01-01']);

    expect($this->putJson("/api/v1/users/{$user->id}/roles", ['roles' => [Role::RECEPTIONIST, Role::DEVELOPER]]))
        ->toBeApiError(409, 'DEVELOPER_UNIQUE');
    expect($this->putJson("/api/v1/staff/{$staff->id}", ['role' => Role::DEVELOPER]))
        ->toBeApiError(409, 'DEVELOPER_UNIQUE');
    expect($user->fresh()->hasRole(Role::DEVELOPER))->toBeFalse();
});

it('el Programador conserva su rol y su cuenta', function () {
    $staff = Staff::create(['user_id' => $this->developer->id, 'position' => 'Soporte', 'shift' => 'morning', 'hired_at' => '2024-01-01']);

    expect($this->putJson("/api/v1/users/{$this->developer->id}/roles", ['roles' => [Role::ADMIN]]))
        ->toBeApiError(409, 'DEVELOPER_LOCKED');
    expect($this->putJson("/api/v1/staff/{$staff->id}", ['role' => Role::ADMIN]))
        ->toBeApiError(409, 'DEVELOPER_LOCKED');
    expect($this->deleteJson("/api/v1/users/{$this->developer->id}"))->toBeApiError(409, 'DEVELOPER_LOCKED');
    expect($this->deleteJson("/api/v1/staff/{$staff->id}"))->toBeApiError(409, 'DEVELOPER_LOCKED');

    // Editar su ficha sin quitarle el rol sí se puede, y también sumarle otro rol.
    $this->putJson("/api/v1/staff/{$staff->id}", ['role' => Role::DEVELOPER, 'shift' => 'night'])->assertOk();
    $this->putJson("/api/v1/users/{$this->developer->id}/roles", ['roles' => [Role::DEVELOPER, Role::ADMIN]])->assertOk();
    expect($this->developer->fresh()->hasRole(Role::DEVELOPER))->toBeTrue();
});
