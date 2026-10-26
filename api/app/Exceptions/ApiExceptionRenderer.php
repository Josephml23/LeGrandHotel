<?php

namespace App\Exceptions;

use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PDOException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Convierte cualquier excepción en el formato JSON único. Nunca devuelve HTML
 * ni trazas: los detalles internos solo van al log con un código de incidente.
 */
class ApiExceptionRenderer
{
    /** Segundos que el cliente debe esperar antes de reintentar tras un 503. */
    public const RETRY_AFTER = 30;

    public function __invoke(Throwable $e): JsonResponse|Response
    {
        return match (true) {
            $e instanceof HttpResponseException => $e->getResponse(),
            $e instanceof ApiException => ApiResponse::error($e->errorCode, $e->getMessage(), $e->status, $e->details),
            $e instanceof ValidationException => ApiResponse::error('VALIDATION_FAILED', 'Los datos enviados no son válidos.', 422, $e->errors()),
            $e instanceof AuthenticationException => ApiResponse::error('UNAUTHENTICATED', 'Sesión no iniciada o token expirado.', 401),
            $e instanceof AuthorizationException, $e instanceof AccessDeniedHttpException => ApiResponse::error('FORBIDDEN', 'No tienes permiso para realizar esta acción.', 403),
            $e instanceof ModelNotFoundException => $this->modelNotFound($e),
            $e instanceof NotFoundHttpException && $e->getPrevious() instanceof ModelNotFoundException => $this->modelNotFound($e->getPrevious()),
            $e instanceof NotFoundHttpException => ApiResponse::error('ROUTE_NOT_FOUND', 'La ruta solicitada no existe.', 404),
            $e instanceof MethodNotAllowedHttpException => ApiResponse::error('METHOD_NOT_ALLOWED', 'Método HTTP no permitido en esta ruta.', 405),
            $e instanceof BadRequestHttpException => ApiResponse::error('BAD_REQUEST', $e->getMessage() ?: 'Petición mal formada.', 400),
            $e instanceof ThrottleRequestsException => ApiResponse::error(
                'TOO_MANY_REQUESTS',
                'Demasiadas peticiones. Intenta de nuevo en unos segundos.',
                429,
                ['retry_after' => (int) ($e->getHeaders()['Retry-After'] ?? 60)],
                $e->getHeaders(),
            ),
            $this->isDatabaseDown($e) => $this->serviceUnavailable($e, 'DATABASE_UNAVAILABLE', 'La base de datos no responde en este momento.'),
            $e instanceof HttpExceptionInterface && $e->getStatusCode() === 503 => ApiResponse::error(
                'SERVICE_UNAVAILABLE',
                'El servicio está en mantenimiento. Vuelve en unos minutos.',
                503,
                ['retry_after' => self::RETRY_AFTER],
                ['Retry-After' => self::RETRY_AFTER],
            ),
            $e instanceof HttpExceptionInterface && $e->getStatusCode() < 500 => ApiResponse::error('HTTP_'.$e->getStatusCode(), $e->getMessage() ?: 'Error en la petición.', $e->getStatusCode()),
            default => $this->internalError($e),
        };
    }

    private function modelNotFound(ModelNotFoundException $e): JsonResponse
    {
        $model = Str::upper(Str::snake(class_basename($e->getModel())));

        return ApiResponse::error("{$model}_NOT_FOUND", 'El recurso solicitado no existe.', 404);
    }

    private function isDatabaseDown(Throwable $e): bool
    {
        if (! $e instanceof QueryException && ! $e instanceof PDOException) {
            return false;
        }

        // 2002: host inalcanzable, 2006: server gone away, 1045: credenciales, HY000 + "Connection refused".
        $message = $e->getMessage();

        return Str::contains($message, ['SQLSTATE[HY000] [2002]', '2006', 'Connection refused', 'server has gone away', 'SQLSTATE[08']);
    }

    private function serviceUnavailable(Throwable $e, string $code, string $message): JsonResponse
    {
        $incident = $this->logIncident($e);

        return ApiResponse::error($code, $message, 503, [
            'incident_id' => $incident,
            'retry_after' => self::RETRY_AFTER,
        ], ['Retry-After' => self::RETRY_AFTER]);
    }

    private function internalError(Throwable $e): JsonResponse
    {
        $incident = $this->logIncident($e);

        return ApiResponse::error('INTERNAL_ERROR', 'Ocurrió un error inesperado. Ya fue registrado.', 500, [
            'incident_id' => $incident,
        ]);
    }

    private function logIncident(Throwable $e): string
    {
        $incident = Str::upper(Str::random(10));
        Log::error($e->getMessage(), [
            'incident_id' => $incident,
            'exception' => $e::class,
            'file' => $e->getFile().':'.$e->getLine(),
        ]);

        return $incident;
    }
}
