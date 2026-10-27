<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Huésped del hotel. Es un registro que llena recepción, no una cuenta: los huéspedes no entran al sistema.
 */
class Client extends Model
{
    use Auditable, HasFactory;

    public const DOCUMENT_TYPES = ['DNI', 'PASAPORTE', 'CE'];

    protected $fillable = ['document_type', 'document_number', 'full_name', 'phone', 'nationality'];

    /** @return HasMany<Reservation, $this> */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }
}
