<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Role::LABELS as $name => $label) {
            Role::updateOrCreate(['name' => $name], ['label' => $label]);
        }
    }
}
