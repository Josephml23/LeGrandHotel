<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\RoomType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Room>
 */
class RoomFactory extends Factory
{
    public function definition(): array
    {
        $floor = fake()->numberBetween(1, 9);

        return [
            'room_type_id' => RoomType::factory(),
            'number' => fake()->unique()->numerify($floor.'##'),
            'floor' => $floor,
            'status' => Room::AVAILABLE,
        ];
    }
}
