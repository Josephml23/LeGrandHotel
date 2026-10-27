<?php

use App\Models\Client;
use App\Models\ParkingSpot;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;

beforeEach(function () {
    $this->room = Room::factory()->for(RoomType::factory()->state(['capacity' => 2, 'price_per_night' => 200]))->create();
    $this->client = Client::factory()->create();
    $this->dates = ['check_in' => now()->addDays(10)->toDateString(), 'check_out' => now()->addDays(13)->toDateString()];
});

describe('recepción', function () {
    beforeEach(fn () => actingAsRole(Role::RECEPTIONIST));

    it('crea una reserva y calcula el total en el servidor', function () {
        $this->postJson('/api/v1/reservations', [
            'client_id' => $this->client->id,
            'room_id' => $this->room->id,
            ...$this->dates,
            'total' => 1, // ignorado: el total no lo decide el cliente
        ])
            ->assertCreated()
            ->assertJsonPath('data.total', '600.00')
            ->assertJsonPath('data.status', Reservation::CONFIRMED);
    });

    it('responde 409 si la habitación ya está reservada en esas fechas', function () {
        Reservation::factory()->for($this->room)->for($this->client)->create($this->dates);

        expect($this->postJson('/api/v1/reservations', ['client_id' => $this->client->id, 'room_id' => $this->room->id, ...$this->dates]))
            ->toBeApiError(409, 'ROOM_ALREADY_BOOKED');
    });

    it('rechaza fechas inválidas y exceso de huéspedes con 422', function () {
        $this->postJson('/api/v1/reservations', [
            'client_id' => $this->client->id, 'room_id' => $this->room->id,
            'check_in' => '2020-01-05', 'check_out' => '2020-01-01',
        ])->assertStatus(422)->assertJsonStructure(['error' => ['details' => ['check_in', 'check_out']]]);

        expect($this->postJson('/api/v1/reservations', ['client_id' => $this->client->id, 'room_id' => $this->room->id, ...$this->dates, 'guests' => 5]))
            ->toBeApiError(422, 'CAPACITY_EXCEEDED');
    });

    it('actualiza fechas, recalcula el total y permite cancelar', function () {
        $reservation = Reservation::factory()->for($this->room)->for($this->client)->create($this->dates);

        $this->putJson("/api/v1/reservations/{$reservation->id}", ['check_out' => now()->addDays(15)->toDateString()])
            ->assertOk()->assertJsonPath('data.total', '1000.00');
        $this->putJson("/api/v1/reservations/{$reservation->id}", ['status' => Reservation::CANCELLED])
            ->assertOk()->assertJsonPath('data.status', Reservation::CANCELLED);
        $this->deleteJson("/api/v1/reservations/{$reservation->id}")->assertNoContent();
    });

    it('hace check-in, asigna cochera y check-out completo', function () {
        $reservation = Reservation::factory()->for($this->room)->for($this->client)->create($this->dates);
        $spot = ParkingSpot::factory()->create();

        $stayId = $this->postJson("/api/v1/reservations/{$reservation->id}/check-in")->assertCreated()->json('data.id');
        expect($this->room->fresh()->status)->toBe(Room::OCCUPIED);

        // check-in repetido → 409
        expect($this->postJson("/api/v1/reservations/{$reservation->id}/check-in"))->toBeApiError(409, 'INVALID_RESERVATION_STATUS');

        $this->postJson('/api/v1/parking-assignments', ['parking_spot_id' => $spot->id, 'stay_id' => $stayId, 'plate' => 'abc-123'])
            ->assertCreated()->assertJsonPath('data.plate', 'ABC-123');
        expect($spot->fresh()->status)->toBe(ParkingSpot::OCCUPIED);
        expect($this->postJson('/api/v1/parking-assignments', ['parking_spot_id' => $spot->id, 'plate' => 'XYZ-999']))
            ->toBeApiError(409, 'PARKING_SPOT_NOT_FREE');

        $this->postJson("/api/v1/stays/{$stayId}/check-out")->assertOk();
        expect($this->room->fresh()->status)->toBe(Room::CLEANING)
            ->and($reservation->fresh()->status)->toBe(Reservation::COMPLETED)
            ->and($spot->fresh()->status)->toBe(ParkingSpot::FREE);

        expect($this->postJson("/api/v1/stays/{$stayId}/check-out"))->toBeApiError(409, 'ALREADY_CHECKED_OUT');
    });

    it('no hace check-in en una habitación que todavía tiene un huésped dentro', function () {
        // Dos reservas de la misma habitación con fechas que no se cruzan: el primero aún no hizo check-out.
        $first = Reservation::factory()->for($this->room)->for($this->client)->create($this->dates);
        $next = Reservation::factory()->for($this->room)->for(Client::factory())->create([
            'check_in' => now()->addDays(13)->toDateString(), 'check_out' => now()->addDays(15)->toDateString(),
        ]);

        $this->postJson("/api/v1/reservations/{$first->id}/check-in")->assertCreated();

        expect($this->postJson("/api/v1/reservations/{$next->id}/check-in"))->toBeApiError(409, 'ROOM_OCCUPIED');
    });
});
