<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Clientes de prueba para la carga del portal (k6-cliente-0@carga.legrandhotel.test …), ya con DNI y teléfono.
 * Los clientes entran solo con Google y k6 no puede iniciar sesión en Google: por eso el seeder les abre la sesión
 * (token de 24 h) y guarda los tokens en tests/k6/.tokens-clientes.json, que lee tests/k6/portal.js.
 * Solo para el entorno de pruebas de carga; se borran con `php artisan k6:limpiar`.
 *   K6_CLIENTS=100 php artisan db:seed --class=LoadTestClientsSeeder
 */
class LoadTestClientsSeeder extends Seeder
{
    public const EMAIL = 'k6-cliente-%d@carga.legrandhotel.test';

    public const TOKENS_FILE = 'tests/k6/.tokens-clientes.json';

    /** Ruta del archivo de tokens (K6_TOKENS_FILE la cambia, por ejemplo en las pruebas). */
    public static function tokensPath(): string
    {
        return (string) (env('K6_TOKENS_FILE') ?: base_path('../'.self::TOKENS_FILE));
    }

    public function run(): void
    {
        $this->call(RoleSeeder::class);

        $count = (int) env('K6_CLIENTS', 50);
        $roleId = Role::where('name', Role::CLIENT)->value('id');
        $now = now();
        $tokens = [];

        for ($i = 0; $i < $count; $i++) {
            $user = User::firstOrCreate(
                ['email' => sprintf(self::EMAIL, $i)],
                ['name' => "Cliente de carga {$i}"],
            );
            $user->forceFill(['google_id' => "k6-cliente-{$i}", 'email_verified_at' => $now])->save();
            DB::table('role_user')->insertOrIgnore(['user_id' => $user->id, 'role_id' => $roleId]);

            // Ficha de huésped ya completa (DNI 70000000 + i, distinto de los de MassiveDataSeeder).
            DB::table('clients')->updateOrInsert(
                ['user_id' => $user->id],
                [
                    'document_type' => 'DNI',
                    'document_number' => (string) (70000000 + $i),
                    'full_name' => $user->name,
                    'phone' => sprintf('9%08d', $i),
                    'nationality' => 'Perú',
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );

            $user->tokens()->where('name', 'k6-carga')->delete();
            $tokens[] = $user->createToken('k6-carga', ['*'], $now->copy()->addDay())->plainTextToken;
        }

        file_put_contents(self::tokensPath(), json_encode($tokens));
        $this->command?->info("Clientes de carga listos: {$count} (tokens en ".self::TOKENS_FILE.')');
    }
}
