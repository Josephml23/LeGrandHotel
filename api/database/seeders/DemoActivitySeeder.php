<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\ParkingAssignment;
use App\Models\ParkingSpot;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\Staff;
use App\Models\Stay;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Llena de actividad las pantallas que el DemoSeeder deja vacías: estadías en curso y pasadas,
 * reservas en todos los estados, habitaciones en limpieza y mantenimiento, autos en la cochera,
 * movimientos de inventario y más personal.
 *
 *   php artisan db:seed --class=DemoActivitySeeder
 *
 * Es idempotente en lo que importa: si ya hay estadías en curso no vuelve a crearlas, así que se
 * puede correr varias veces sin llenar el hotel de duplicados. Solo para desarrollo y demostración.
 */
class DemoActivitySeeder extends Seeder
{
    /** Personal extra, además de las cuatro cuentas del DemoSeeder. */
    private const PERSONAL = [
        ['Lucía Fernández Rivas', 'lucia.fernandez@legrandhotel.test', Role::RECEPTIONIST, 14],
        ['Carlos Medina Soto', 'carlos.medina@legrandhotel.test', Role::RECEPTIONIST, 26],
        ['Rosa Quispe Mamani', 'rosa.quispe@legrandhotel.test', Role::RECEPTIONIST, 8],
        ['Javier Torres Paredes', 'javier.torres@legrandhotel.test', Role::STOREKEEPER, 19],
        ['Elena Vargas Núñez', 'elena.vargas@legrandhotel.test', Role::STOREKEEPER, 33],
        ['Marco Salas Benítez', 'marco.salas@legrandhotel.test', Role::ADMIN, 41],
    ];

    /** Insumos extra para que el almacén tenga variedad. */
    private const INSUMOS = [
        ['Toallas de mano', 'unidad', 90, 30],
        ['Café en grano', 'kilogramo', 12, 15],
        ['Detergente', 'litro', 40, 12],
        ['Bolsas de basura', 'paquete', 55, 20],
        ['Almohadas', 'unidad', 38, 25],
        ['Kit dental', 'unidad', 140, 60],
        ['Gel de ducha', 'unidad', 18, 40],
        ['Fundas de almohada', 'juego', 70, 25],
    ];

    private const MOTIVOS_ENTRADA = [
        'Compra a proveedor', 'Reposición mensual', 'Devolución de pisos', 'Ajuste de inventario',
    ];

    private const MOTIVOS_SALIDA = [
        'Reposición de habitaciones', 'Consumo de huéspedes', 'Limpieza de pisos', 'Merma',
    ];

    private const PLACAS = ['V1A-234', 'W2B-567', 'X3C-890', 'Y4D-123', 'Z5E-456', 'A6F-789', 'B7G-012', 'C8H-345'];

    public function run(): void
    {
        $inicio = microtime(true);
        $hoy = Carbon::today();

        $this->personal();
        $this->insumos();
        $this->espacios();

        $enCurso = $this->estadiasEnCurso($hoy);
        $this->estadiasPasadas();
        $this->reservasDeTodoTipo($hoy);
        $this->habitacionesEnLimpiezaYMantenimiento();
        $this->cochera($enCurso);
        $this->movimientosDeInventario();

        $this->command?->info(sprintf(
            'Datos de demostración listos en %.1f s: %d estadías en curso, %d en el historial, %d autos en cochera, %d movimientos.',
            microtime(true) - $inicio,
            Stay::whereNull('checked_out_at')->count(),
            Stay::whereNotNull('checked_out_at')->count(),
            ParkingAssignment::whereNull('left_at')->count(),
            InventoryMovement::count(),
        ));
    }

    /** Más gente en «Personal y usuarios», con distintos roles y fechas de ingreso. */
    private function personal(): void
    {
        $password = env('DEMO_PASSWORD', 'LeGrand2026');

        foreach (self::PERSONAL as [$nombre, $correo, $rol, $mesesAtras]) {
            $user = User::updateOrCreate(['email' => $correo], [
                'name' => $nombre,
                'password' => $password,
                'email_verified_at' => now(),
            ]);
            $user->assignRole($rol);
            Staff::firstOrCreate(
                ['user_id' => $user->id],
                ['hired_at' => now()->subMonths($mesesAtras)->toDateString()],
            );
        }
    }

    private function insumos(): void
    {
        foreach (self::INSUMOS as [$nombre, $unidad, $stock, $minimo]) {
            InventoryItem::firstOrCreate(['name' => $nombre], ['unit' => $unidad, 'stock' => $stock, 'min_stock' => $minimo]);
        }
    }

    /** Veinte espacios de cochera en vez de diez, y uno en mantenimiento. */
    private function espacios(): void
    {
        foreach (range(1, 20) as $i) {
            ParkingSpot::firstOrCreate(['code' => sprintf('E-%02d', $i)], ['status' => ParkingSpot::FREE]);
        }
        ParkingSpot::where('code', 'E-20')->update(['status' => ParkingSpot::MAINTENANCE]);
    }

    /**
     * Huéspedes alojados ahora: reserva que cubre hoy, con check-in hecho y la habitación ocupada.
     *
     * @return Collection<int, Stay>
     */
    private function estadiasEnCurso(Carbon $hoy): Collection
    {
        $yaHay = Stay::whereNull('checked_out_at')->count();
        if ($yaHay >= 10) {
            return Stay::whereNull('checked_out_at')->get();
        }

        $faltan = 12 - $yaHay;
        $clientes = Client::inRandomOrder()->limit($faltan)->pluck('id')->all();
        $habitaciones = $this->habitacionesLibres($hoy->copy()->subDays(3), $hoy->copy()->addDays(4), $faltan);
        $nuevas = collect();

        foreach ($habitaciones as $i => $room) {
            $entrada = $hoy->copy()->subDays(random_int(0, 3));
            $salida = $hoy->copy()->addDays(random_int(1, 4));
            $noches = max(1, $entrada->diffInDays($salida));

            $reserva = Reservation::create([
                'client_id' => $clientes[$i % max(1, count($clientes))],
                'room_id' => $room->id,
                'check_in' => $entrada->toDateString(),
                'check_out' => $salida->toDateString(),
                'guests' => random_int(1, 2),
                'status' => Reservation::CHECKED_IN,
                'total' => $noches * (float) $room->roomType->price_per_night,
            ]);

            $nuevas->push(Stay::create([
                'reservation_id' => $reserva->id,
                'checked_in_at' => $entrada->copy()->setTime(random_int(13, 20), random_int(0, 59)),
            ]));

            $room->update(['status' => Room::OCCUPIED]);
        }

        return Stay::whereNull('checked_out_at')->get();
    }

    /** Historial de estadías: las reservas ya cerradas también pasaron por recepción. */
    private function estadiasPasadas(): void
    {
        if (Stay::whereNotNull('checked_out_at')->count() >= 50) {
            return;
        }

        $reservas = Reservation::where('status', Reservation::COMPLETED)
            ->whereDoesntHave('stay')
            ->where('check_out', '>=', now()->subMonths(3)->toDateString())
            ->orderByDesc('check_out')
            ->limit(80)
            ->get();

        foreach ($reservas as $reserva) {
            Stay::create([
                'reservation_id' => $reserva->id,
                'checked_in_at' => $reserva->check_in->copy()->setTime(random_int(13, 20), random_int(0, 59)),
                'checked_out_at' => $reserva->check_out->copy()->setTime(random_int(7, 12), random_int(0, 59)),
            ]);
        }
    }

    /** Reservas en los estados que faltan, para que los filtros de la pestaña no salgan vacíos. */
    private function reservasDeTodoTipo(Carbon $hoy): void
    {
        $pendientes = Reservation::where('status', Reservation::PENDING)->count();
        $canceladas = Reservation::where('status', Reservation::CANCELLED)->count();
        $llegadasHoy = Reservation::where('status', Reservation::CONFIRMED)->whereDate('check_in', $hoy)->count();

        $clientes = Client::inRandomOrder()->limit(40)->pluck('id')->all();
        $c = 0;
        $siguienteCliente = function () use ($clientes, &$c) {
            return $clientes[$c++ % count($clientes)];
        };

        // Por confirmar: reservas nuevas repartidas en las próximas semanas.
        foreach (range(1, max(0, 14 - $pendientes)) as $_) {
            $this->reservaSuelta($hoy, $siguienteCliente(), Reservation::PENDING, random_int(2, 45));
        }

        // Canceladas: quedan en el listado pero no ocupan la habitación.
        foreach (range(1, max(0, 9 - $canceladas)) as $_) {
            $this->reservaSuelta($hoy, $siguienteCliente(), Reservation::CANCELLED, random_int(-20, 30));
        }

        // Llegadas de hoy: lo que recepción ve apenas entra al Panel.
        foreach (range(1, max(0, 6 - $llegadasHoy)) as $_) {
            $this->reservaSuelta($hoy, $siguienteCliente(), Reservation::CONFIRMED, 0);
        }
    }

    /** Crea una reserva en la primera habitación libre del rango; si no hay, no hace nada. */
    private function reservaSuelta(Carbon $hoy, int $clienteId, string $estado, int $diasDesdeHoy): void
    {
        $entrada = $hoy->copy()->addDays($diasDesdeHoy);
        $noches = random_int(1, 3);
        $salida = $entrada->copy()->addDays($noches);

        // Una reserva cancelada no bloquea el calendario, así que puede ir en cualquier habitación.
        $room = $estado === Reservation::CANCELLED
            ? Room::inRandomOrder()->with('roomType')->first()
            : $this->habitacionesLibres($entrada, $salida, 1)->first();

        if (! $room) {
            return;
        }

        Reservation::create([
            'client_id' => $clienteId,
            'room_id' => $room->id,
            'check_in' => $entrada->toDateString(),
            'check_out' => $salida->toDateString(),
            'guests' => random_int(1, 2),
            'status' => $estado,
            'total' => $noches * (float) $room->roomType->price_per_night,
        ]);
    }

    /**
     * Habitaciones sin ninguna reserva que bloquee ese rango.
     *
     * @return Collection<int, Room>
     */
    private function habitacionesLibres(Carbon $desde, Carbon $hasta, int $cuantas): Collection
    {
        return Room::with('roomType')
            ->whereDoesntHave('reservations', function ($q) use ($desde, $hasta) {
                $q->whereIn('status', Reservation::BLOCKING)
                    ->where('check_in', '<', $hasta->toDateString())
                    ->where('check_out', '>', $desde->toDateString());
            })
            ->inRandomOrder()
            ->limit($cuantas)
            ->get();
    }

    /** El tablero del panel se ve vivo si hay habitaciones en limpieza y en mantenimiento. */
    private function habitacionesEnLimpiezaYMantenimiento(): void
    {
        // Solo habitaciones sin nadie por llegar esta semana: mandar a mantenimiento una
        // habitación que ya tiene huésped para mañana se ve como un error en la demostración.
        $libres = Room::where('status', Room::AVAILABLE)
            ->whereDoesntHave('reservations', function ($q) {
                $q->whereIn('status', Reservation::BLOCKING)
                    ->where('check_in', '<=', now()->addDays(7)->toDateString())
                    ->where('check_out', '>=', now()->toDateString());
            })
            ->inRandomOrder()->limit(8)->pluck('id');

        Room::whereIn('id', $libres->take(5))->update(['status' => Room::CLEANING]);
        Room::whereIn('id', $libres->slice(5))->update(['status' => Room::MAINTENANCE]);
    }

    /**
     * Autos en la cochera: unos dentro (de huéspedes alojados) y otros que ya se fueron.
     *
     * @param  Collection<int, Stay>  $enCurso
     */
    private function cochera(Collection $enCurso): void
    {
        if (ParkingAssignment::count() > 0) {
            return;
        }

        $libres = ParkingSpot::where('status', ParkingSpot::FREE)->orderBy('code')->get();
        $dentro = $enCurso->take(6);

        foreach ($dentro as $i => $stay) {
            $spot = $libres[$i] ?? null;
            if (! $spot) {
                break;
            }

            ParkingAssignment::create([
                'parking_spot_id' => $spot->id,
                'stay_id' => $stay->id,
                'plate' => self::PLACAS[$i % count(self::PLACAS)],
                'entered_at' => $stay->checked_in_at,
            ]);
            $spot->update(['status' => ParkingSpot::OCCUPIED]);
        }

        // Historial: autos de estadías ya cerradas, que entraron y salieron.
        $pasadas = Stay::whereNotNull('checked_out_at')->latest('checked_out_at')->limit(12)->get();
        foreach ($pasadas as $i => $stay) {
            ParkingAssignment::create([
                'parking_spot_id' => $libres[($i + 6) % max(1, $libres->count())]->id,
                'stay_id' => $stay->id,
                'plate' => sprintf('%s%d-%03d', chr(65 + $i % 26), random_int(1, 9), random_int(100, 999)),
                'entered_at' => $stay->checked_in_at,
                'left_at' => $stay->checked_out_at,
            ]);
        }
    }

    /**
     * Movimientos de entrada y salida de los últimos meses. El stock que queda es el que ya
     * tiene cada insumo, así que los movimientos se generan sin volver a tocarlo.
     */
    private function movimientosDeInventario(): void
    {
        if (InventoryMovement::count() > 0) {
            return;
        }

        $almaceneros = User::whereHas('roles', fn ($q) => $q->whereIn('name', [Role::STOREKEEPER, Role::ADMIN]))
            ->pluck('id')->all();
        if ($almaceneros === []) {
            return;
        }

        $filas = [];
        foreach (InventoryItem::all() as $item) {
            foreach (range(1, random_int(6, 11)) as $_) {
                $entrada = random_int(0, 2) > 0;
                $filas[] = [
                    'inventory_item_id' => $item->id,
                    'user_id' => $almaceneros[array_rand($almaceneros)],
                    'type' => $entrada ? InventoryMovement::IN : InventoryMovement::OUT,
                    'quantity' => $entrada ? random_int(10, 60) : random_int(2, 20),
                    'reason' => $entrada
                        ? self::MOTIVOS_ENTRADA[array_rand(self::MOTIVOS_ENTRADA)]
                        : self::MOTIVOS_SALIDA[array_rand(self::MOTIVOS_SALIDA)],
                    'created_at' => now()->subDays(random_int(1, 120))->setTime(random_int(7, 19), random_int(0, 59)),
                ];
            }
        }

        foreach (array_chunk($filas, 200) as $chunk) {
            DB::table('inventory_movements')->insert($chunk);
        }
    }
}
