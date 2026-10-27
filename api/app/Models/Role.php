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

    /** Huésped con cuenta propia: solo entra con Google y solo reserva para sí mismo. */
    public const CLIENT = 'client';

    /** Nombre visible de cada rol. */
    public const LABELS = [
        self::ADMIN => 'Administrador',
        self::RECEPTIONIST => 'Recepcionista',
        self::STOREKEEPER => 'Almacenero',
        self::DEVELOPER => 'Programador',
        self::CLIENT => 'Cliente',
    ];

    /** Roles del personal del hotel: entran con correo y contraseña y usan el panel interno. */
    public const INTERNAL = [self::ADMIN, self::RECEPTIONIST, self::STOREKEEPER, self::DEVELOPER];

    /** Cuentas del personal que el Programador puede crear; las de Programador solo las crea el Administrador. */
    public const CREATABLE_BY_DEVELOPER = [self::ADMIN, self::RECEPTIONIST, self::STOREKEEPER];

    /** @return list<string> Roles que $user puede asignar al registrar una cuenta del personal. */
    public static function creatableBy(User $user): array
    {
        return $user->isAdmin() ? self::INTERNAL : self::CREATABLE_BY_DEVELOPER;
    }

    protected $fillable = ['name', 'label'];

    /** @return BelongsToMany<User, $this> */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
