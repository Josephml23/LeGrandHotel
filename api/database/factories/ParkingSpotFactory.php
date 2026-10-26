<?php

namespace Database\Factories;

use App\Models\ParkingSpot;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParkingSpot>
 */
class ParkingSpotFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->bothify('E-##?'),
            'status' => ParkingSpot::FREE,
        ];
    }
}
