<?php

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(fn () => $this->seed(RoleSeeder::class))
    ->in('Feature', 'Unit');

/**
 * Crea un usuario con el rol indicado y lo autentica con Sanctum.
 */
function actingAsRole(string $role, array $attributes = []): User
{
    $user = User::factory()->withRole($role)->create($attributes);
    Sanctum::actingAs($user->fresh());

    return $user->fresh();
}

/** Comprueba el formato único de error y su código. */
expect()->extend('toBeApiError', function (int $status, ?string $code = null) {
    $this->value->assertStatus($status)->assertJsonPath('success', false);
    if ($code) {
        $this->value->assertJsonPath('error.code', $code);
    }

    return $this;
});
