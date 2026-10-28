<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiExceptionRenderer;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Salud de la app, la BD y la caché. El ALB solo envía tráfico a instancias con 200.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'app' => ['status' => 'ok'],
            'database' => $this->check(fn () => DB::select('select 1')),
            'cache' => $this->check(function () {
                Cache::put('health:ping', 1, 10);

                return Cache::get('health:ping') === 1 ?: throw new \RuntimeException('cache read failed');
            }),
        ];

        $healthy = collect($checks)->every(fn ($c) => $c['status'] === 'ok');

        $body = [
            'success' => $healthy,
            'data' => [
                'status' => $healthy ? 'ok' : 'degraded',
                'version' => config('hotel.version'),
                'time' => now()->toIso8601String(),
                'checks' => $checks,
            ],
        ];

        if ($healthy) {
            return response()->json($body);
        }

        $down = collect($checks)->filter(fn ($c) => $c['status'] !== 'ok')->keys()->implode(', ');
        $body['error'] = [
            'code' => 'SERVICE_UNAVAILABLE',
            'message' => __('Servicio degradado: no responde :down.', ['down' => $down]),
            'details' => ['retry_after' => ApiExceptionRenderer::RETRY_AFTER],
        ];

        return response()->json($body, 503, ['Retry-After' => ApiExceptionRenderer::RETRY_AFTER]);
    }

    private function check(callable $probe): array
    {
        $start = microtime(true);
        try {
            $probe();

            return ['status' => 'ok', 'latency_ms' => round((microtime(true) - $start) * 1000, 2)];
        } catch (Throwable $e) {
            report($e);

            return ['status' => 'down'];
        }
    }
}
