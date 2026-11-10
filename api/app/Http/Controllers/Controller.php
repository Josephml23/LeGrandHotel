<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

abstract class Controller
{
    use AuthorizesRequests;

    /** ?per_page= acotado entre 1 y el máximo configurado (50). */
    protected function perPage(Request $request): int
    {
        $perPage = (int) $request->query('per_page', config('hotel.pagination.default'));

        return max(1, min($perPage, config('hotel.pagination.max')));
    }

    /** Escapa comodines de LIKE para que la búsqueda sea literal. */
    protected function like(string $term): string
    {
        return '%'.addcslashes($term, '%_\\').'%';
    }

    /**
     * Operador de búsqueda que no distingue mayúsculas: MySQL ya lo hace por su collation,
     * pero PostgreSQL necesita ILIKE (si no, buscar «ana» no encontraría a «Ana»).
     */
    protected function likeOperator(): string
    {
        return DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
    }
}
