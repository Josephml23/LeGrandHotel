<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Clientes verificados para las pruebas k6 (k6-0@carga.legrandhotel.test …).
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
        $roleId = Role::where('name', Role::CLIENT)->value('id');
        $now = now();

        foreach (array_chunk(range(0, $count - 1), 250) as $chunk) {
            DB::table('users')->insertOrIgnore(array_map(fn ($i) => [
                'name' => "Huésped de carga {$i}",
                'email' => "k6-{$i}@carga.legrandhotel.test",
                'password' => $password,
                'email_verified_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk));

            $users = DB::table('users')->whereIn('email', array_map(fn ($i) => "k6-{$i}@carga.legrandhotel.test", $chunk))->pluck('id', 'email');

            DB::table('role_user')->insertOrIgnore($users->map(fn ($id) => ['user_id' => $id, 'role_id' => $roleId])->values()->all());
            DB::table('clients')->insertOrIgnore($users->values()->map(fn ($id) => [
                'user_id' => $id,
                'document_type' => 'DNI',
                'document_number' => (string) (90000000 + $id),
                'full_name' => "Huésped de carga {$id}",
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        }

        $this->command?->info("Usuarios de carga listos: {$count}");
    }
}
