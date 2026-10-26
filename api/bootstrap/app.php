<?php

use App\Exceptions\ApiException;
use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\RequestContext;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(RequestContext::class);
        $middleware->append(SecurityHeaders::class);
        $middleware->alias(['role' => EnsureUserHasRole::class]);
        // El rol se valida antes de buscar el modelo: sin permiso → 403, nunca 404 (no revela qué ids existen).
        $middleware->prependToPriorityList(SubstituteBindings::class, EnsureUserHasRole::class);
        // API stateless: sin redirecciones a una vista de login.
        $middleware->redirectGuestsTo(fn () => null);
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Ningún error sale como HTML ni con trazas: todo pasa por el formato JSON único.
        $exceptions->shouldRenderJsonWhen(fn () => true);
        $exceptions->render(fn (Throwable $e, Request $request) => (new ApiExceptionRenderer)($e));
        $exceptions->dontReport([ApiException::class]);
    })->create();
