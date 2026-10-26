<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    public const ADMIN = 'admin';

    public const RECEPTIONIST = 'receptionist';

    public const STOREKEEPER = 'storekeeper';

    public const CLIENT = 'client';

    /** Nombre visible de cada rol. */
    public const LABELS = [
        self::ADMIN => 'Administrador',
        self::RECEPTIONIST => 'Recepcionista',
        self::STOREKEEPER => 'Almacenero',
        self::CLIENT => 'Cliente',
    ];

    protected $fillable = ['name', 'label'];

    /** @return BelongsToMany<User, $this> */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
