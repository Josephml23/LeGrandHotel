<?php

namespace Database\Factories;

use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Staff>
 */
class StaffFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->withRole(Role::RECEPTIONIST),
            'position' => fake()->randomElement(['Recepcionista', 'Almacenero', 'Supervisor']),
            'shift' => fake()->randomElement(Staff::SHIFTS),
            'hired_at' => fake()->dateTimeBetween('-5 years', '-1 month')->format('Y-m-d'),
        ];
    }
}
