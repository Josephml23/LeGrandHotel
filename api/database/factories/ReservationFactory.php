<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Reservation;
use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Reservation>
 */
class ReservationFactory extends Factory
{
    public function definition(): array
    {
        $checkIn = fake()->dateTimeBetween('+1 day', '+60 days');
        $nights = fake()->numberBetween(1, 5);

        return [
            'client_id' => Client::factory(),
            'room_id' => Room::factory(),
            'check_in' => $checkIn->format('Y-m-d'),
            'check_out' => (clone $checkIn)->modify("+{$nights} days")->format('Y-m-d'),
            'guests' => 1,
            'status' => Reservation::CONFIRMED,
            'total' => $nights * 150,
        ];
    }
}
