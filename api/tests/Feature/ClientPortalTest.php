<?php

use App\Models\Client;
use App\Models\Reservation;
use App\Models\Role;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as GoogleUser;

/** Simula la respuesta de Google en el callback de Socialite. */
function fakeGoogleUser(string $email, string $id = 'g-123', string $name = 'Luis Pérez'): void
{
    $googleUser = (new GoogleUser)->map(['id' => $id, 'name' => $name, 'email' => $email]);
    $provider = Mockery::mock(GoogleProvider::class);
    $provider->shouldReceive('stateless')->andReturnSelf();
    $provider->shouldReceive('user')->andReturn($googleUser);
    Socialite::shouldReceive('driver')->with('google')->andReturn($provider);
}

/** Cliente con su ficha (DNI y teléfono) ya completa, autenticado. */
function actingAsClient(): User
{
    $user = actingAsRole(Role::CLIENT);
    $client = Client::factory()->create(['full_name' => $user->name]);
    $client->user_id = $user->id;
    $client->save();

    return $user->fresh();
}

describe('registro con Google', function () {
    it('crea una cuenta de cliente la primera vez y no la duplica después', function () {
        fakeGoogleUser('luis@gmail.com');

        $this->get('/api/v1/auth/google/callback')->assertRedirectContains('/auth/callback#token=');
        $this->get('/api/v1/auth/google/callback')->assertRedirectContains('/auth/callback#token=');

        $user = User::where('email', 'luis@gmail.com')->sole();
        expect($user->hasRole(Role::CLIENT))->toBeTrue()
            ->and($user->hasVerifiedEmail())->toBeTrue()
            ->and($user->password)->toBeNull();
    });

    it('no deja entrar con Google a una cuenta del personal', function () {
        User::factory()->withRole(Role::RECEPTIONIST)->create(['email' => 'rosa@legrandhotel.pe']);
        fakeGoogleUser('rosa@legrandhotel.pe');

        $this->get('/api/v1/auth/google/callback')->assertRedirectContains('/login?error=google_personal');
    });

    it('un cliente no puede entrar con contraseña', function () {
        User::factory()->withRole(Role::CLIENT)->create(['email' => 'cli@gmail.com', 'password' => 'Clave1234']);

        expect($this->postJson('/api/v1/auth/login', ['email' => 'cli@gmail.com', 'password' => 'Clave1234']))
            ->toBeApiError(403, 'ACCOUNT_WITHOUT_ACCESS');
    });
});

describe('datos del cliente (DNI y teléfono)', function () {
    it('indica que falta completar el registro y lo guarda', function () {
        actingAsRole(Role::CLIENT);
        $this->getJson('/api/v1/auth/me')->assertJsonPath('data.client', null);

        $this->putJson('/api/v1/portal/profile', ['document_number' => '45678912', 'phone' => '987654321'])
            ->assertOk()
            ->assertJsonPath('data.client.document_number', '45678912');
    });

    it('enlaza la ficha que recepción ya tenía con ese DNI en vez de duplicarla', function () {
        $existing = Client::factory()->create(['document_number' => '45678912']);
        $user = actingAsRole(Role::CLIENT);

        $this->putJson('/api/v1/portal/profile', ['document_number' => '45678912', 'phone' => '987654321'])->assertOk();

        expect(Client::count())->toBe(1)
            ->and($existing->fresh()->user_id)->toBe($user->id);
    });

    it('responde 409 si el DNI ya pertenece a otra cuenta', function () {
        $other = User::factory()->withRole(Role::CLIENT)->create();
        $taken = Client::factory()->create(['document_number' => '45678912']);
        $taken->user_id = $other->id;
        $taken->save();
        actingAsRole(Role::CLIENT);

        expect($this->putJson('/api/v1/portal/profile', ['document_number' => '45678912', 'phone' => '987654321']))
            ->toBeApiError(409, 'DOCUMENT_ALREADY_LINKED');
    });

    it('valida el formato del DNI y del teléfono', function () {
        actingAsRole(Role::CLIENT);

        $this->putJson('/api/v1/portal/profile', ['document_number' => '123', 'phone' => '12345'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['document_number', 'phone'], 'error.details');
    });
});

describe('reservas del cliente', function () {
    beforeEach(function () {
        $this->suite = RoomType::factory()->create(['name' => 'Suite', 'capacity' => 4, 'price_per_night' => 450, 'amenities' => ['Wi-Fi', 'Jacuzzi']]);
        $this->rooms = Room::factory()->count(2)->for($this->suite)->sequence(['number' => '401'], ['number' => '402'])->create();
        $this->dates = ['check_in' => now()->addDays(5)->toDateString(), 'check_out' => now()->addDays(8)->toDateString()];
    });

    it('muestra los tipos disponibles con sus servicios, habitaciones libres y total', function () {
        actingAsClient();
        Reservation::factory()->for($this->rooms[0])->create($this->dates);

        $this->getJson("/api/v1/portal/room-types?from={$this->dates['check_in']}&to={$this->dates['check_out']}&guests=2")
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Suite')
            ->assertJsonPath('data.0.amenities', ['Wi-Fi', 'Jacuzzi'])
            ->assertJsonPath('data.0.available_rooms', 1)
            ->assertJsonPath('data.0.nights', 3)
            ->assertJsonPath('data.0.total', '1350.00');
    });

    it('reserva por tipo y asigna una habitación libre', function () {
        $user = actingAsClient();
        Reservation::factory()->for($this->rooms[0])->create($this->dates);

        $this->postJson('/api/v1/portal/reservations', ['room_type_id' => $this->suite->id, 'guests' => 2, ...$this->dates])
            ->assertCreated()
            ->assertJsonPath('data.room.number', '402')
            ->assertJsonPath('data.client_id', $user->client->id)
            ->assertJsonPath('data.total', '1350.00');
    });

    it('responde 409 cuando ya no quedan habitaciones de ese tipo', function () {
        actingAsClient();
        $this->rooms->each(fn ($room) => Reservation::factory()->for($room)->create($this->dates));

        expect($this->postJson('/api/v1/portal/reservations', ['room_type_id' => $this->suite->id, 'guests' => 2, ...$this->dates]))
            ->toBeApiError(409, 'NO_ROOMS_AVAILABLE');
    });

    it('no deja reservar sin completar el DNI y teléfono', function () {
        actingAsRole(Role::CLIENT);

        expect($this->postJson('/api/v1/portal/reservations', ['room_type_id' => $this->suite->id, 'guests' => 2, ...$this->dates]))
            ->toBeApiError(409, 'PROFILE_INCOMPLETE');
    });

    it('rechaza fechas pasadas', function () {
        actingAsClient();

        $this->postJson('/api/v1/portal/reservations', [
            'room_type_id' => $this->suite->id, 'guests' => 2,
            'check_in' => now()->subDay()->toDateString(), 'check_out' => now()->addDay()->toDateString(),
        ])->assertUnprocessable();
    });

    it('lista y cancela solo sus propias reservas', function () {
        $user = actingAsClient();
        $mine = Reservation::factory()->for($this->rooms[0])->for($user->client)->create($this->dates);
        $others = Reservation::factory()->for($this->rooms[1])->create($this->dates);

        $this->getJson('/api/v1/portal/reservations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine->id);

        $this->postJson("/api/v1/portal/reservations/{$mine->id}/cancel")->assertOk()->assertJsonPath('data.status', Reservation::CANCELLED);
        expect($this->postJson("/api/v1/portal/reservations/{$others->id}/cancel"))->toBeApiError(403, 'FORBIDDEN');
    });

    it('no cancela una reserva que ya empezó', function () {
        $user = actingAsClient();
        $started = Reservation::factory()->for($this->rooms[0])->for($user->client)->create([
            'check_in' => now()->toDateString(), 'check_out' => now()->addDays(2)->toDateString(),
        ]);

        expect($this->postJson("/api/v1/portal/reservations/{$started->id}/cancel"))->toBeApiError(409, 'CANNOT_CANCEL');
    });
});

describe('separación entre clientes y personal', function () {
    it('un cliente no entra a las rutas del personal', function (string $method, string $uri) {
        actingAsClient();

        expect($this->json($method, $uri))->toBeApiError(403, 'FORBIDDEN');
    })->with([
        'panel' => ['GET', '/api/v1/dashboard'],
        'reservas de todos' => ['GET', '/api/v1/reservations'],
        'huéspedes' => ['GET', '/api/v1/clients'],
        'registrar personal' => ['POST', '/api/v1/auth/register'],
    ]);

    it('el personal no usa el portal del cliente', function () {
        actingAsRole(Role::RECEPTIONIST);

        expect($this->getJson('/api/v1/portal/reservations'))->toBeApiError(403, 'FORBIDDEN');
    });
});

describe('registro de personal por Administrador y Programador', function () {
    $payload = fn (string $role) => [
        'name' => 'Nueva Persona', 'email' => "nueva-{$role}@legrandhotel.pe",
        'password' => 'Segura2026', 'password_confirmation' => 'Segura2026', 'role' => $role,
    ];

    it('el Programador crea cuentas de Recepción, Administración y Almacén', function (string $role) use ($payload) {
        actingAsRole(Role::DEVELOPER);

        $this->postJson('/api/v1/auth/register', $payload($role))->assertCreated()->assertJsonPath('data.roles.0', $role);
    })->with([Role::RECEPTIONIST, Role::ADMIN, Role::STOREKEEPER]);

    it('el Programador no puede crear otro Programador', function () use ($payload) {
        actingAsRole(Role::DEVELOPER);

        $this->postJson('/api/v1/auth/register', $payload(Role::DEVELOPER))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role'], 'error.details');
    });

    it('el Administrador sí puede crear un Programador, pero nadie crea clientes', function () use ($payload) {
        actingAsRole(Role::ADMIN);

        $this->postJson('/api/v1/auth/register', $payload(Role::DEVELOPER))->assertCreated();
        $this->postJson('/api/v1/auth/register', $payload(Role::CLIENT))->assertUnprocessable();
    });
});
