<?php

namespace Database\Factories;

use App\Models\RoomType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomType>
 */
class RoomTypeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'description' => fake()->sentence(),
            'amenities' => fake()->randomElements(['Wi-Fi', 'TV', 'Baño privado', 'Aire acondicionado', 'Minibar', 'Jacuzzi'], 3),
            'capacity' => fake()->numberBetween(1, 4),
            'price_per_night' => fake()->randomFloat(2, 80, 600),
        ];
    }
}
