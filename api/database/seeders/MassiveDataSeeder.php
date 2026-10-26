<?php

namespace Database\Seeders;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomType;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Datos masivos para medir los listados paginados:
 * 50 habitaciones, 1000 clientes y 5000 reservas (100 por habitación, sin cruces de fechas).
 *
 * Usa inserciones por lotes (sin eventos de modelo) para que tarde segundos y no minutos.
 */
class MassiveDataSeeder extends Seeder
{
    public const ROOMS = 50;

    public const CLIENTS = 1000;

    public const RESERVATIONS = 5000;

    public function run(): void
    {
        $this->call(RoleSeeder::class);
        $start = microtime(true);
        $now = now();
        $faker = fake('es_PE');

        $types = RoomType::count() ? RoomType::all() : collect([
            RoomType::create(['name' => 'Simple', 'capacity' => 1, 'price_per_night' => 120]),
            RoomType::create(['name' => 'Doble', 'capacity' => 2, 'price_per_night' => 180]),
            RoomType::create(['name' => 'Suite', 'capacity' => 4, 'price_per_night' => 450]),
        ]);

        // Habitaciones 1000-1049 para no chocar con las de demostración.
        $rooms = collect(range(0, self::ROOMS - 1))->map(fn ($i) => [
            'room_type_id' => $types[$i % $types->count()]->id,
            'number' => (string) (1000 + $i),
            'floor' => 10 + intdiv($i, 10),
            'status' => Room::AVAILABLE,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('rooms')->insertOrIgnore($rooms->all());
        $roomRows = DB::table('rooms')->whereIn('number', $rooms->pluck('number'))->get(['id', 'room_type_id']);
        $prices = $types->pluck('price_per_night', 'id');

        $base = 80000000 + (int) DB::table('clients')->max('id');
        foreach (array_chunk(range(1, self::CLIENTS), 500) as $chunk) {
            DB::table('clients')->insert(array_map(fn ($i) => [
                'document_type' => 'DNI',
                'document_number' => (string) ($base + $i),
                'full_name' => $faker->name(),
                'phone' => $faker->numerify('9########'),
                'nationality' => 'Perú',
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk));
        }
        $clientIds = DB::table('clients')->orderByDesc('id')->limit(self::CLIENTS)->pluck('id')->all();

        $perRoom = intdiv(self::RESERVATIONS, max(1, $roomRows->count()));
        $rows = [];
        foreach ($roomRows as $room) {
            $cursor = CarbonImmutable::now()->subDays(250);
            for ($n = 0; $n < $perRoom; $n++) {
                $nights = random_int(1, 3);
                $checkIn = $cursor->addDays(random_int(0, 1));
                $checkOut = $checkIn->addDays($nights);
                $cursor = $checkOut;

                $rows[] = [
                    'client_id' => $clientIds[array_rand($clientIds)],
                    'room_id' => $room->id,
                    'check_in' => $checkIn->toDateString(),
                    'check_out' => $checkOut->toDateString(),
                    'guests' => 1,
                    'status' => $checkOut->isPast() ? Reservation::COMPLETED : Reservation::CONFIRMED,
                    'total' => $nights * (float) $prices[$room->room_type_id],
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                if (count($rows) === 500) {
                    DB::table('reservations')->insert($rows);
                    $rows = [];
                }
            }
        }
        if ($rows) {
            DB::table('reservations')->insert($rows);
        }

        $this->command?->info(sprintf(
            'Datos masivos: %d habitaciones, %d clientes, %d reservas en %.1f s',
            $roomRows->count(), self::CLIENTS, $perRoom * $roomRows->count(), microtime(true) - $start,
        ));
    }
}
