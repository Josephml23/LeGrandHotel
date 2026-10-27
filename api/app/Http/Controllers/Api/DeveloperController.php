<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RequestLogReader;
use App\Support\ApiResponse;
use Illuminate\Foundation\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route as RouteFacade;
use Illuminate\Support\Str;

/**
 * Vista del programador: diagnóstico del sistema sin entrar al servidor.
 * Nunca expone secretos (contraseñas, claves, tokens): solo nombres de drivers y límites.
 */
class DeveloperController extends Controller
{
    private const TABLES = [
        'users', 'roles', 'clients', 'staff', 'room_types', 'rooms', 'reservations', 'stays',
        'parking_spots', 'parking_assignments', 'inventory_items', 'inventory_movements',
        'audit_logs', 'personal_access_tokens',
    ];

    public function __construct(private readonly RequestLogReader $logs) {}

    /** GET /dev/overview: versión, entorno, configuración relevante y conteo de tablas. */
    public function overview(): JsonResponse
    {
        $start = microtime(true);
        $counts = [];
        foreach (self::TABLES as $table) {
            $counts[$table] = DB::table($table)->count();
        }

        return ApiResponse::success([
            'app' => [
                'name' => config('app.name'),
                'version' => config('hotel.version'),
                'environment' => app()->environment(),
                'debug' => (bool) config('app.debug'),
                'timezone' => config('app.timezone'),
                'php' => PHP_VERSION,
                'laravel' => Application::VERSION,
                'opcache' => function_exists('opcache_get_status') && (opcache_get_status(false)['opcache_enabled'] ?? false),
            ],
            'drivers' => [
                'database' => DB::connection()->getDriverName(),
                'cache' => config('cache.default'),
                'queue' => config('queue.default'),
                'log_channel' => config('logging.default'),
                'mail' => config('mail.default'),
            ],
            'security' => [
                'token_minutes' => (int) config('sanctum.expiration'),
                'rate_limits_per_minute' => config('hotel.rate_limits'),
                'cors_origins' => config('cors.allowed_origins'),
                'pagination_max' => config('hotel.pagination.max'),
                'google_login_configured' => filled(config('services.google.client_id')),
            ],
            'tables' => $counts,
            'query_ms' => round((microtime(true) - $start) * 1000, 2),
        ]);
    }

    /** GET /dev/routes: las rutas de /api/v1 con método, middleware de rol y controlador. */
    public function routes(): JsonResponse
    {
        $routes = collect(RouteFacade::getRoutes()->getRoutes())
            ->filter(fn (Route $route) => Str::startsWith($route->uri(), 'api/v1'))
            ->map(function (Route $route) {
                $middleware = $route->gatherMiddleware();
                $roles = collect($middleware)
                    ->filter(fn ($m) => is_string($m) && Str::startsWith($m, 'role:'))
                    ->flatMap(fn ($m) => explode(',', Str::after($m, 'role:')))
                    ->unique()->values();

                return [
                    'methods' => array_values(array_diff($route->methods(), ['HEAD'])),
                    'uri' => '/'.$route->uri(),
                    'auth' => in_array('auth:sanctum', $middleware, true),
                    'roles' => $roles,
                    'throttle' => collect($middleware)->first(fn ($m) => is_string($m) && Str::startsWith($m, 'throttle:')),
                    'action' => Str::after((string) $route->getActionName(), 'App\\Http\\Controllers\\Api\\'),
                ];
            })
            ->sortBy('uri')
            ->values();

        return ApiResponse::success($routes, 200, ['total' => $routes->count()]);
    }

    /** GET /dev/requests: últimas peticiones del log JSON con métricas de latencia y errores. */
    public function requests(Request $request): JsonResponse
    {
        $data = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
            'status' => ['nullable', 'in:2xx,3xx,4xx,5xx'],
            'route' => ['nullable', 'string', 'max:120'],
        ]);

        $rows = collect($this->logs->requests())
            // La propia vista del programador no se cuenta en sus métricas.
            ->reject(fn ($r) => Str::startsWith((string) $r['route'], 'api/v1/dev'));

        $durations = $rows->pluck('duration_ms')->all();
        $total = $rows->count();

        $byRoute = $rows->groupBy(fn ($r) => $r['method'].' /'.$r['route'])
            ->map(fn ($group, $key) => [
                'route' => $key,
                'count' => $group->count(),
                'p95_ms' => RequestLogReader::percentile($group->pluck('duration_ms')->all(), 95),
                'errors' => $group->where('status', '>=', 500)->count(),
            ])
            ->sortByDesc('p95_ms')->take(8)->values();

        $filtered = $rows
            ->when($data['status'] ?? null, fn ($c, $s) => $c->filter(fn ($r) => intdiv($r['status'], 100) === (int) $s[0]))
            ->when($data['route'] ?? null, fn ($c, $q) => $c->filter(fn ($r) => Str::contains((string) $r['route'], $q)))
            ->take($data['limit'] ?? 50)
            ->values();

        return ApiResponse::success([
            'summary' => [
                'sampled' => $total,
                'p50_ms' => RequestLogReader::percentile($durations, 50),
                'p95_ms' => RequestLogReader::percentile($durations, 95),
                'p99_ms' => RequestLogReader::percentile($durations, 99),
                'status' => [
                    '2xx' => $rows->filter(fn ($r) => $r['status'] < 300)->count(),
                    '4xx' => $rows->filter(fn ($r) => $r['status'] >= 400 && $r['status'] < 500)->count(),
                    '5xx' => $rows->filter(fn ($r) => $r['status'] >= 500)->count(),
                ],
                'slowest_routes' => $byRoute,
            ],
            'requests' => $filtered,
        ]);
    }

    /** GET /dev/errors: errores registrados con su código de incidente (el que ve el usuario). */
    public function errors(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', 30), 100));
        $incident = $request->query('incident');

        $rows = collect($this->logs->errors())
            ->when($incident, fn ($c) => $c->where('incident_id', strtoupper((string) $incident)))
            ->take($limit)
            ->values();

        return ApiResponse::success($rows, 200, ['total' => $rows->count()]);
    }
}
