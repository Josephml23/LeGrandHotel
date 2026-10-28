<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Idioma de las respuestas según la cabecera Accept-Language (la web la envía con el idioma elegido en Configuración).
 * Admite español (por defecto) e inglés; los textos en inglés están en lang/en.json (la validación usa los del framework).
 */
class SetLocale
{
    public const SUPPORTED = ['es', 'en'];

    public function handle(Request $request, Closure $next): Response
    {
        $lang = strtolower(substr((string) $request->header('Accept-Language'), 0, 2));
        app()->setLocale(in_array($lang, self::SUPPORTED, true) ? $lang : config('app.locale'));

        $response = $next($request);
        $response->headers->set('Content-Language', app()->getLocale());

        return $response;
    }
}
