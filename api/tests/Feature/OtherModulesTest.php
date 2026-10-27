<?php

use App\Models\Client;
use App\Models\InventoryItem;
use App\Models\ParkingSpot;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;

describe('clientes', function () {
    beforeEach(fn () => actingAsRole(Role::RECEPTIONIST));

    it('CRUD completo con búsqueda por documento', function () {
        $id = $this->postJson('/api/v1/clients', [
            'full_name' => 'Luis Pérez', 'document_type' => 'DNI', 'document_number' => '40404040', 'nationality' => 'Perú',
        ])->assertCreated()->json('data.id');

        $this->getJson('/api/v1/clients?search=4040')->assertOk()->assertJsonPath('meta.total', 1);
        $this->putJson("/api/v1/clients/{$id}", ['phone' => '999888777'])->assertOk()->assertJsonPath('data.phone', '999888777');
        $this->deleteJson("/api/v1/clients/{$id}")->assertNoContent();
    });

    it('no elimina clientes con reservas (409)', function () {
        $reservation = Reservation::factory()->create();

        expect($this->deleteJson("/api/v1/clients/{$reservation->client_id}"))->toBeApiError(409, 'CLIENT_HAS_RESERVATIONS');
    });

    it('el documento es único', function () {
        Client::factory()->create(['document_number' => '12345678']);

        $this->postJson('/api/v1/clients', ['full_name' => 'X', 'document_type' => 'DNI', 'document_number' => '12345678'])->assertStatus(422);
    });
});

describe('cochera', function () {
    beforeEach(fn () => actingAsRole(Role::RECEPTIONIST));

    it('CRUD de espacios y salida que libera el espacio', function () {
        $id = $this->postJson('/api/v1/parking-spots', ['code' => 'E-01'])->assertCreated()->json('data.id');
        $this->putJson("/api/v1/parking-spots/{$id}", ['code' => 'E-1A'])->assertOk();

        $assignment = $this->postJson('/api/v1/parking-assignments', ['parking_spot_id' => $id, 'plate' => 'B2C-456'])->assertCreated()->json('data.id');
        $this->putJson("/api/v1/parking-assignments/{$assignment}", ['left_at' => now()->addHour()->toDateTimeString()])->assertOk();
        expect(ParkingSpot::find($id)->status)->toBe(ParkingSpot::FREE);

        expect($this->deleteJson("/api/v1/parking-spots/{$id}"))->toBeApiError(409, 'PARKING_SPOT_IN_USE');
        $this->deleteJson("/api/v1/parking-assignments/{$assignment}")->assertNoContent();
        $this->deleteJson("/api/v1/parking-spots/{$id}")->assertNoContent();
    });
});

describe('inventario', function () {
    beforeEach(fn () => $this->user = actingAsRole(Role::STOREKEEPER));

    it('CRUD y movimientos de entrada y salida', function () {
        $id = $this->postJson('/api/v1/inventory-items', ['name' => 'Toallas', 'unit' => 'unidad', 'stock' => 20, 'min_stock' => 10])
            ->assertCreated()->assertJsonPath('data.low_stock', false)->json('data.id');

        $this->postJson("/api/v1/inventory-items/{$id}/movements", ['type' => 'out', 'quantity' => 12, 'reason' => 'Lavandería'])
            ->assertCreated()
            ->assertJsonPath('data.item.stock', 8)
            ->assertJsonPath('data.item.low_stock', true);

        $this->postJson("/api/v1/inventory-items/{$id}/movements", ['type' => 'in', 'quantity' => 30])->assertCreated()->assertJsonPath('data.item.stock', 38);
        $this->getJson("/api/v1/inventory-items/{$id}/movements")->assertOk()->assertJsonPath('meta.total', 2);
        $this->assertDatabaseHas('inventory_movements', ['inventory_item_id' => $id, 'user_id' => $this->user->id, 'type' => 'out']);

        $this->getJson('/api/v1/inventory-items?low_stock=1')->assertOk()->assertJsonPath('meta.total', 0);
        $this->putJson("/api/v1/inventory-items/{$id}", ['min_stock' => 50])->assertOk()->assertJsonPath('data.low_stock', true);
        $this->deleteJson("/api/v1/inventory-items/{$id}")->assertNoContent();
    });

    it('no permite sacar más stock del disponible (409)', function () {
        $item = InventoryItem::factory()->create(['stock' => 5]);

        expect($this->postJson("/api/v1/inventory-items/{$item->id}/movements", ['type' => 'out', 'quantity' => 6]))
            ->toBeApiError(409, 'INSUFFICIENT_STOCK');
        expect($item->fresh()->stock)->toBe(5);
    });

    it('el stock no se edita directamente', function () {
        $item = InventoryItem::factory()->create();

        $this->putJson("/api/v1/inventory-items/{$item->id}", ['stock' => 999])->assertStatus(422);
    });
});

describe('personal y usuarios (admin)', function () {
    beforeEach(fn () => $this->admin = actingAsRole(Role::ADMIN));

    it('CRUD de personal crea la cuenta con su rol', function () {
        $id = $this->postJson('/api/v1/staff', [
            'name' => 'Rosa Díaz', 'email' => 'rosa@hotel.test', 'password' => 'Clave1234',
            'role' => Role::STOREKEEPER, 'position' => 'Almacenera', 'shift' => 'night', 'hired_at' => '2024-03-01',
        ])->assertCreated()->json('data.id');

        $user = User::where('email', 'rosa@hotel.test')->first();
        expect($user->hasRole(Role::STOREKEEPER))->toBeTrue();

        $this->putJson("/api/v1/staff/{$id}", ['role' => Role::RECEPTIONIST, 'shift' => 'morning'])->assertOk();
        expect($user->fresh()->hasRole(Role::RECEPTIONIST))->toBeTrue()
            ->and($user->fresh()->hasRole(Role::STOREKEEPER))->toBeFalse();

        $this->deleteJson("/api/v1/staff/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('users', ['email' => 'rosa@hotel.test']);
    });

    it('no puede eliminarse a sí mismo', function () {
        $staff = Staff::create(['user_id' => $this->admin->id, 'position' => 'Gerente', 'shift' => 'morning', 'hired_at' => '2024-01-01']);

        expect($this->deleteJson("/api/v1/staff/{$staff->id}"))->toBeApiError(409, 'CANNOT_DELETE_SELF');
        expect($this->deleteJson("/api/v1/users/{$this->admin->id}"))->toBeApiError(409, 'CANNOT_DELETE_SELF');
    });

    it('CRUD de usuarios y cambio de roles', function () {
        $id = $this->postJson('/api/v1/users', ['name' => 'Pepe', 'email' => 'pepe@hotel.test', 'password' => 'Clave1234', 'roles' => [Role::STOREKEEPER]])
            ->assertCreated()->json('data.id');

        $this->putJson("/api/v1/users/{$id}/roles", ['roles' => [Role::RECEPTIONIST, Role::STOREKEEPER]])
            ->assertOk()->assertJsonCount(2, 'data.roles');
        $this->putJson("/api/v1/users/{$id}", ['name' => 'José'])->assertOk()->assertJsonPath('data.name', 'José');
        $this->getJson('/api/v1/users?role=storekeeper')->assertOk()->assertJsonPath('meta.total', 1);
        $this->deleteJson("/api/v1/users/{$id}")->assertNoContent();
    });

    it('reportes de ocupación e ingresos', function () {
        Reservation::factory()->create(['check_in' => now()->toDateString(), 'check_out' => now()->addDays(2)->toDateString(), 'total' => 300]);

        $this->getJson('/api/v1/reports/occupancy')->assertOk()->assertJsonStructure(['data' => ['total_rooms', 'occupancy_rate', 'nights_sold']]);
        $this->getJson('/api/v1/reports/income')->assertOk()->assertJsonPath('data.total_income', 300);
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonStructure(['data' => ['rooms', 'today', 'income_month', 'low_stock']]);
    });
});
