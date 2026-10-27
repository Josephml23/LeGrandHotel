<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    public const ADMIN = 'admin';

    public const RECEPTIONIST = 'receptionist';

    public const STOREKEEPER = 'storekeeper';

    public const DEVELOPER = 'developer';

    /** Nombre visible de cada rol. */
    public const LABELS = [
        self::ADMIN => 'Administrador',
        self::RECEPTIONIST => 'Recepcionista',
        self::STOREKEEPER => 'Almacenero',
        self::DEVELOPER => 'Programador',
    ];

    /** Todos los roles son del personal del hotel: el sistema no tiene usuarios externos. */
    public const INTERNAL = [self::ADMIN, self::RECEPTIONIST, self::STOREKEEPER, self::DEVELOPER];

    protected $fillable = ['name', 'label'];

    /** @return BelongsToMany<User, $this> */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
