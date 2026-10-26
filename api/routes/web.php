<?php

use Illuminate\Support\Facades\Route;

// La API no sirve vistas: la raíz solo indica dónde está la API.
Route::get('/', fn () => response()->json([
    'success' => true,
    'data' => ['name' => 'LeGrandHotel API', 'version' => 'v1', 'health' => url('/api/v1/health')],
]));
