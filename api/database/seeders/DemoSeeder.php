<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\InventoryItem;
use App\Models\ParkingSpot;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Cuentas y datos de demostración para desarrollo local y la presentación.
 * La contraseña se toma de DEMO_PASSWORD (.env); nunca usar estas cuentas en producción.
 */
class DemoSeeder extends Seeder
{
    public const USERS = [
        ['Administrador Demo', 'admin@legrandhotel.test', Role::ADMIN, 'Gerente'],
        ['Recepción Demo', 'recepcion@legrandhotel.test', Role::RECEPTIONIST, 'Recepcionista'],
        ['Almacén Demo', 'almacen@legrandhotel.test', Role::STOREKEEPER, 'Almacenero'],
        ['Programador Demo', 'dev@legrandhotel.test', Role::DEVELOPER, 'Programador'],
    ];

    public function run(): void
    {
        $password = env('DEMO_PASSWORD', 'LeGrand2026');

        foreach (self::USERS as [$name, $email, $role, $position]) {
            $user = User::updateOrCreate(['email' => $email], [
                'name' => $name,
                'password' => $password,
                'email_verified_at' => now(),
            ]);
            $user->assignRole($role);
            Staff::firstOrCreate(['user_id' => $user->id], [
                'position' => $position,
                'shift' => 'morning',
                'hired_at' => now()->subYear()->toDateString(),
            ]);
        }

        $guest = User::updateOrCreate(['email' => 'cliente@legrandhotel.test'], [
            'name' => 'Cliente Demo',
            'password' => $password,
            'email_verified_at' => now(),
        ]);
        $guest->assignRole(Role::CLIENT);
        Client::firstOrCreate(['user_id' => $guest->id], [
            'document_type' => 'DNI',
            'document_number' => '70000001',
            'full_name' => 'Cliente Demo',
            'phone' => '987654321',
            'nationality' => 'Perú',
        ]);

        $types = collect([
            ['Simple', 'Cama de 1.5 plazas, ideal para viajes de trabajo.', 1, 120],
            ['Doble', 'Dos camas de 1.5 plazas.', 2, 180],
            ['Matrimonial', 'Cama queen y vista a la ciudad.', 2, 220],
            ['Suite', 'Sala independiente, jacuzzi y desayuno incluido.', 4, 450],
        ])->map(fn ($t) => RoomType::firstOrCreate(['name' => $t[0]], [
            'description' => $t[1], 'capacity' => $t[2], 'price_per_night' => $t[3],
        ]));

        foreach (range(1, 4) as $floor) {
            foreach (range(1, 5) as $n) {
                Room::firstOrCreate(['number' => sprintf('%d%02d', $floor, $n)], [
                    'room_type_id' => $types[($n - 1) % $types->count()]->id,
                    'floor' => $floor,
                    'status' => Room::AVAILABLE,
                ]);
            }
        }

        foreach (range(1, 10) as $i) {
            ParkingSpot::firstOrCreate(['code' => sprintf('E-%02d', $i)], ['status' => ParkingSpot::FREE]);
        }

        foreach ([
            ['Toallas', 'unidad', 120, 40], ['Jabón de tocador', 'unidad', 30, 50],
            ['Papel higiénico', 'paquete', 80, 30], ['Shampoo', 'unidad', 15, 40],
            ['Sábanas 1.5 plazas', 'juego', 60, 20], ['Agua mineral', 'caja', 25, 10],
        ] as [$name, $unit, $stock, $min]) {
            InventoryItem::firstOrCreate(['name' => $name], ['unit' => $unit, 'stock' => $stock, 'min_stock' => $min]);
        }
    }
}
