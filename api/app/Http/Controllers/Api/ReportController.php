<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Services\ReservationService;
use App\Support\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function __construct(private readonly ReservationService $service) {}

    /** GET /reports/occupancy?from=&to= : ocupación actual y noches vendidas en el rango. */
    public function occupancy(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        $data = Cache::remember("report:occupancy:{$from}:{$to}", 60, function () use ($from, $to) {
            $totalRooms = Room::count();
            $byStatus = Room::query()->select('status', DB::raw('count(*) as total'))->groupBy('status')->pluck('total', 'status');

            $nightsSold = Reservation::query()
                ->whereIn('status', [Reservation::CONFIRMED, Reservation::CHECKED_IN, Reservation::COMPLETED])
                ->where('check_in', '<', $to)
                ->where('check_out', '>', $from)
                ->get(['check_in', 'check_out'])
                ->sum(fn ($r) => $this->service->nights(
                    max($r->check_in->toDateString(), $from),
                    min($r->check_out->toDateString(), $to),
                ));

            $nightsAvailable = $totalRooms * max(1, $this->service->nights($from, $to));

            return [
                'from' => $from,
                'to' => $to,
                'total_rooms' => $totalRooms,
                'rooms_by_status' => $byStatus,
                'occupied_now' => (int) ($byStatus[Room::OCCUPIED] ?? 0),
                'current_occupancy_rate' => $totalRooms ? round(($byStatus[Room::OCCUPIED] ?? 0) / $totalRooms * 100, 1) : 0,
                'nights_sold' => $nightsSold,
                'occupancy_rate' => $nightsAvailable ? round($nightsSold / $nightsAvailable * 100, 1) : 0,
            ];
        });

        return ApiResponse::success($data);
    }

    /** GET /reports/income?from=&to= : ingresos por mes de reservas confirmadas o cerradas. */
    public function income(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request, months: 6);
        $month = DB::connection()->getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', check_in)"
            : "DATE_FORMAT(check_in, '%Y-%m')";

        $data = Cache::remember("report:income:{$from}:{$to}", 60, function () use ($from, $to, $month) {
            $rows = DB::table('reservations')
                ->selectRaw("{$month} as month, count(*) as reservations, sum(total) as income")
                ->whereIn('status', [Reservation::CONFIRMED, Reservation::CHECKED_IN, Reservation::COMPLETED])
                ->whereBetween('check_in', [$from, $to])
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->map(fn ($r) => [
                    'month' => $r->month,
                    'reservations' => (int) $r->reservations,
                    'income' => round((float) $r->income, 2),
                ]);

            return [
                'from' => $from,
                'to' => $to,
                'total_income' => round($rows->sum('income'), 2),
                'months' => $rows,
            ];
        });

        return ApiResponse::success($data);
    }

    /** Resumen del panel según el rol del usuario. */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = now()->toDateString();
        $data = [];

        if ($user->hasRole(Role::ADMIN, Role::RECEPTIONIST)) {
            $totalRooms = Room::count();
            $occupied = Room::where('status', Room::OCCUPIED)->count();
            $data['rooms'] = [
                'total' => $totalRooms,
                'occupied' => $occupied,
                'available' => Room::where('status', Room::AVAILABLE)->count(),
                'cleaning' => Room::where('status', Room::CLEANING)->count(),
                'occupancy_rate' => $totalRooms ? round($occupied / $totalRooms * 100, 1) : 0,
            ];
            $data['today'] = [
                'check_ins' => Reservation::where('check_in', $today)->whereIn('status', [Reservation::PENDING, Reservation::CONFIRMED])->count(),
                'check_outs' => Reservation::where('check_out', $today)->where('status', Reservation::CHECKED_IN)->count(),
            ];
        }

        if ($user->hasRole(Role::ADMIN)) {
            $data['income_month'] = round((float) Reservation::query()
                ->whereIn('status', [Reservation::CONFIRMED, Reservation::CHECKED_IN, Reservation::COMPLETED])
                ->whereBetween('check_in', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
                ->sum('total'), 2);
        }

        if ($user->hasRole(Role::ADMIN, Role::STOREKEEPER, Role::RECEPTIONIST)) {
            $data['low_stock'] = InventoryItem::whereColumn('stock', '<=', 'min_stock')->orderBy('stock')->limit(5)->get();
            $data['low_stock_count'] = InventoryItem::whereColumn('stock', '<=', 'min_stock')->count();
        }

        return ApiResponse::success($data);
    }

    /** @return array{string, string} */
    private function range(Request $request, int $months = 0): array
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after:from'],
        ]);

        $now = CarbonImmutable::now();
        $from = $request->query('from') ?? ($months ? $now->subMonths($months)->startOfMonth() : $now->startOfMonth())->toDateString();
        $to = $request->query('to') ?? ($months ? $now->endOfMonth() : $now->endOfMonth()->addDay())->toDateString();

        return [$from, $to];
    }
}
