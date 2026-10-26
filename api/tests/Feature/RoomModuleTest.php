<?php

use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;

beforeEach(fn () => actingAsRole(Role::ADMIN));

describe('tipos de habitación', function () {
    it('CRUD completo', function () {
        $id = $this->postJson('/api/v1/room-types', ['name' => 'Suite', 'capacity' => 4, 'price_per_night' => 450])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Suite')
            ->json('data.id');

        $this->getJson("/api/v1/room-types/{$id}")->assertOk()->assertJsonPath('data.price_per_night', '450.00');
        $this->putJson("/api/v1/room-types/{$id}", ['price_per_night' => 500])->assertOk()->assertJsonPath('data.price_per_night', '500.00');
        $this->getJson('/api/v1/room-types?search=sui')->assertOk()->assertJsonPath('meta.total', 1);
        $this->deleteJson("/api/v1/room-types/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('room_types', ['id' => $id]);
    });

    it('no elimina un tipo con habitaciones (409)', function () {
        $room = Room::factory()->create();

        expect($this->deleteJson("/api/v1/room-types/{$room->room_type_id}"))->toBeApiError(409, 'ROOM_TYPE_IN_USE');
    });

    it('valida capacidad y precio', function () {
        $this->postJson('/api/v1/room-types', ['name' => 'X', 'capacity' => 0, 'price_per_night' => -5])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['capacity', 'price_per_night']]]);
    });
});

describe('habitaciones', function () {
    it('CRUD completo y cambio de estado', function () {
        $type = RoomType::factory()->create();

        $id = $this->postJson('/api/v1/rooms', ['room_type_id' => $type->id, 'number' => '305', 'floor' => 3])
            ->assertCreated()
            ->assertJsonPath('data.status', Room::AVAILABLE)
            ->json('data.id');

        $this->putJson("/api/v1/rooms/{$id}", ['floor' => 4])->assertOk()->assertJsonPath('data.floor', 4);
        $this->patchJson("/api/v1/rooms/{$id}/status", ['status' => Room::MAINTENANCE])->assertOk()->assertJsonPath('data.status', Room::MAINTENANCE);
        $this->getJson('/api/v1/rooms?status=maintenance')->assertOk()->assertJsonPath('meta.total', 1);
        $this->deleteJson("/api/v1/rooms/{$id}")->assertNoContent();
    });

    it('rechaza números repetidos', function () {
        $room = Room::factory()->create(['number' => '101']);

        $this->postJson('/api/v1/rooms', ['room_type_id' => $room->room_type_id, 'number' => '101', 'floor' => 1])->assertStatus(422);
    });

    it('lista solo las disponibles en un rango', function () {
        $busy = Room::factory()->create();
        $free = Room::factory()->create();
        Room::factory()->create(['status' => Room::MAINTENANCE]);
        Reservation::factory()->for($busy)->create(['check_in' => '2030-05-10', 'check_out' => '2030-05-12']);

        $ids = collect($this->getJson('/api/v1/rooms/available?from=2030-05-11&to=2030-05-13')->assertOk()->json('data'))->pluck('id');

        expect($ids->all())->toBe([$free->id]);
    });
});
