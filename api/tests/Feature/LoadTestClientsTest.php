<?php

use App\Models\Client;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\User;
use Database\Seeders\LoadTestClientsSeeder;

beforeEach(function () {
    $this->tokens = tempnam(sys_get_temp_dir(), 'k6');
    putenv("K6_TOKENS_FILE={$this->tokens}");
    putenv('K6_CLIENTS=3');
});

afterEach(function () {
    putenv('K6_TOKENS_FILE');
    putenv('K6_CLIENTS');
    @unlink($this->tokens);
});

it('crea clientes de prueba con ficha completa y tokens que sirven en el portal', function () {
    $this->seed(LoadTestClientsSeeder::class);

    $tokens = json_decode(file_get_contents($this->tokens), true);
    expect($tokens)->toHaveCount(3)
        ->and(User::where('email', 'like', '%@carga.legrandhotel.test')->count())->toBe(3)
        ->and(Client::whereNotNull('user_id')->count())->toBe(3);

    $this->withToken($tokens[0])->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.roles', [Role::CLIENT])
        ->assertJsonPath('data.client.document_number', '70000000');
});

it('k6:limpiar borra las cuentas de carga y sus reservas, pero no a los huéspedes reales', function () {
    $this->seed(LoadTestClientsSeeder::class);
    $cliente = User::where('email', 'like', '%@carga.legrandhotel.test')->first()->client;
    Reservation::factory()->for($cliente)->create();
    $real = User::factory()->withRole(Role::CLIENT)->create();
    $fichaReal = Client::factory()->create(['user_id' => $real->id]);
    $masivo = Client::factory()->create(['user_id' => null]);

    $this->artisan('k6:limpiar')->assertSuccessful();

    expect(User::where('email', 'like', '%@carga.legrandhotel.test')->exists())->toBeFalse()
        ->and(Reservation::count())->toBe(0)
        ->and($fichaReal->fresh())->not->toBeNull()
        ->and($masivo->fresh())->not->toBeNull()
        ->and(file_exists($this->tokens))->toBeFalse();

    // Con --masivos también se van los huéspedes sin cuenta web, y la habitación de una estadía abierta queda libre.
    $reserva = Reservation::factory()->for($masivo)->create();
    $reserva->room->update(['status' => Room::OCCUPIED]);
    $reserva->stay()->create(['checked_in_at' => now()]);

    $this->artisan('k6:limpiar --masivos')->assertSuccessful();

    expect($masivo->fresh())->toBeNull()
        ->and($fichaReal->fresh())->not->toBeNull()
        ->and($reserva->room->fresh()->status)->toBe(Room::AVAILABLE);
});
