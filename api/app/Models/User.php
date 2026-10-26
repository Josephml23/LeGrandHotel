<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use Auditable, HasApiTokens, HasFactory, Notifiable;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'google_id',
        'email_verified_at',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'google_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            // bcrypt automático: nunca se guarda una contraseña en texto plano.
            'password' => 'hashed',
        ];
    }

    /** @return BelongsToMany<Role, $this> */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    /** @return HasOne<Client, $this> */
    public function client(): HasOne
    {
        return $this->hasOne(Client::class);
    }

    /** @return HasOne<Staff, $this> */
    public function staff(): HasOne
    {
        return $this->hasOne(Staff::class);
    }

    public function hasRole(string ...$roles): bool
    {
        $names = $this->relationLoaded('roles')
            ? $this->roles->pluck('name')
            : $this->roles()->pluck('name');

        return $names->intersect($roles)->isNotEmpty();
    }

    public function isAdmin(): bool
    {
        return $this->hasRole(Role::ADMIN);
    }

    public function assignRole(string $name): void
    {
        $role = Role::where('name', $name)->firstOrFail();
        $this->roles()->syncWithoutDetaching([$role->id]);
        $this->unsetRelation('roles');
    }
}
