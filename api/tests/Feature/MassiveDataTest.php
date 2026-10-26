<?php

use App\Models\Role;
use Database\Seeders\MassiveDataSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Prueba masiva mínima: con 50 habitaciones, 1000 clientes y 5000 reservas
 * los listados paginados deben responder rápido.
 */
it('carga datos masivos y los listados paginados responden en menos de 500 ms', function () {
    $this->seed(MassiveDataSeeder::class);

    expect(DB::table('rooms')->count())->toBe(50)
        ->and(DB::table('clients')->count())->toBe(1000)
        ->and(DB::table('reservations')->count())->toBe(5000);

    actingAsRole(Role::ADMIN);

    foreach (['/api/v1/reservations?per_page=50&page=40', '/api/v1/clients?per_page=50&search=8', '/api/v1/rooms?per_page=50'] as $uri) {
        $start = microtime(true);
        $this->getJson($uri)->assertOk();
        $ms = (microtime(true) - $start) * 1000;

        expect($ms)->toBeLessThan(500, "{$uri} tardó {$ms} ms");
    }
});
