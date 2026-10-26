<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;

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
}
