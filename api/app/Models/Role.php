<?php

namespace App\Models;

use App\Exceptions\ApiException;
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

    /**
     * Roles que el Administrador y el Programador pueden dar al crear o editar personal.
     * El Programador es único: su cuenta ya existe (DemoSeeder) y desde la aplicación no se crea otro.
     */
    public const ASSIGNABLE = [self::ADMIN, self::RECEPTIONIST, self::STOREKEEPER];

    /**
     * Impide que una cuenta reciba el rol de Programador o que el Programador único lo pierda.
     *
     * @param  list<string>  $roles  Roles que tendrá la cuenta después del cambio.
     */
    public static function guardDeveloper(User $user, array $roles): void
    {
        $isDeveloper = $user->hasRole(self::DEVELOPER);
        $keepsDeveloper = in_array(self::DEVELOPER, $roles, true);

        if ($keepsDeveloper && ! $isDeveloper) {
            throw ApiException::conflict('DEVELOPER_UNIQUE', 'Solo puede existir un Programador.');
        }
        if ($isDeveloper && ! $keepsDeveloper) {
            throw ApiException::conflict('DEVELOPER_LOCKED', 'El rol de Programador no se puede quitar: es la única cuenta de soporte técnico.');
        }
    }

    protected $fillable = ['name', 'label'];

    /** @return BelongsToMany<User, $this> */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
