<?php

namespace Database\Factories;

use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Client>
 */
class ClientFactory extends Factory
{
    public function definition(): array
    {
        return [
            'document_type' => 'DNI',
            'document_number' => fake()->unique()->numerify('########'),
            'full_name' => fake()->name(),
            'phone' => fake()->numerify('9########'),
            'nationality' => fake()->randomElement(['Perú', 'Chile', 'Argentina', 'Colombia', 'España', 'EE. UU.']),
        ];
    }
}
