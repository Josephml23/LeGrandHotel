<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

/**
 * Formato único de respuesta de la API.
 *
 * Éxito: { "success": true, "data": ..., "meta": {...} }
 * Error: { "success": false, "error": { "code", "message", "details" } }
 */
class ApiResponse
{
    public static function success(mixed $data = null, int $status = 200, array $meta = []): JsonResponse
    {
        $body = ['success' => true, 'data' => $data];
        if ($meta !== []) {
            $body['meta'] = $meta;
        }

        return response()->json($body, $status);
    }

    public static function created(mixed $data): JsonResponse
    {
        return self::success($data, 201);
    }

    public static function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    public static function paginated(LengthAwarePaginator $paginator): JsonResponse
    {
        return self::success($paginator->items(), 200, [
            'page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ]);
    }

    public static function error(string $code, string $message, int $status, mixed $details = null, array $headers = []): JsonResponse
    {
        $error = ['code' => $code, 'message' => $message];
        if ($details !== null) {
            $error['details'] = $details;
        }

        return response()->json(['success' => false, 'error' => $error], $status, $headers);
    }
}
