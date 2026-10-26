<?php

namespace Database\Factories;

use App\Models\InventoryItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryItem>
 */
class InventoryItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'unit' => fake()->randomElement(['unidad', 'caja', 'litro', 'paquete']),
            'stock' => fake()->numberBetween(20, 200),
            'min_stock' => 10,
        ];
    }
}
