<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Fuerza respuestas JSON, rechaza JSON mal formado (400) y escribe una línea
 * de log estructurado por petición (request_id, user_id, route, status, duration_ms).
 */
class RequestContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $start = microtime(true);
        $requestId = $request->headers->get('X-Request-Id') ?: (string) Str::uuid();

        $request->headers->set('Accept', 'application/json');
        Log::withContext(['request_id' => $requestId]);

        $this->rejectMalformedJson($request);

        $response = $next($request);
        $response->headers->set('X-Request-Id', $requestId);

        Log::channel(config('logging.request_channel'))->info('request', [
            'request_id' => $requestId,
            'user_id' => $request->user()?->id,
            'method' => $request->method(),
            'route' => $request->route()?->uri() ?? $request->path(),
            'status' => $response->getStatusCode(),
            'duration_ms' => round((microtime(true) - $start) * 1000, 2),
            'ip' => $request->ip(),
        ]);

        return $response;
    }

    private function rejectMalformedJson(Request $request): void
    {
        $content = $request->getContent();

        if ($content === '' || ! $request->isJson()) {
            return;
        }

        json_decode($content);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new BadRequestHttpException('El cuerpo de la petición no es un JSON válido.');
        }
    }
}
