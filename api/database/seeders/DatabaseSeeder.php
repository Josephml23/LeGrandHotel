<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * php artisan migrate --seed                       → roles + datos de demostración
     * php artisan db:seed --class=MassiveDataSeeder    → datos masivos para pruebas de rendimiento
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            DemoSeeder::class,
        ]);
    }
}
