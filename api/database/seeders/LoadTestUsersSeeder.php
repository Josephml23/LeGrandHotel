<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Recepcionistas de prueba para las corridas k6 (k6-0@carga.legrandhotel.test …).
 * Solo para el entorno de pruebas de carga:
 *   K6_USERS=500 K6_PASSWORD=... php artisan db:seed --class=LoadTestUsersSeeder --force
 */
class LoadTestUsersSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        $count = (int) env('K6_USERS', 500);
        $password = Hash::make(env('K6_PASSWORD', 'CargaK6-2026'));
        $roleId = Role::where('name', Role::RECEPTIONIST)->value('id');
        $now = now();

        foreach (array_chunk(range(0, $count - 1), 250) as $chunk) {
            // Si la cuenta ya existe, se le vuelve a poner la clave de la prueba (pudo crearse con otra).
            DB::table('users')->upsert(array_map(fn ($i) => [
                'name' => "Recepción de carga {$i}",
                'email' => "k6-{$i}@carga.legrandhotel.test",
                'password' => $password,
                'email_verified_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk), ['email'], ['password', 'email_verified_at', 'updated_at']);

            $users = DB::table('users')->whereIn('email', array_map(fn ($i) => "k6-{$i}@carga.legrandhotel.test", $chunk))->pluck('id', 'email');

            DB::table('role_user')->insertOrIgnore($users->map(fn ($id) => ['user_id' => $id, 'role_id' => $roleId])->values()->all());
        }

        $this->command?->info("Usuarios de carga listos: {$count}");
    }
}
