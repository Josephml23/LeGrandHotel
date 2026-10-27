<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Huésped del hotel. La ficha la puede llenar recepción o el propio huésped al registrarse con Google;
 * en ese caso queda enlazada a su usuario (user_id).
 */
class Client extends Model
{
    use Auditable, HasFactory;

    public const DOCUMENT_TYPES = ['DNI', 'PASAPORTE', 'CE'];

    protected $fillable = ['document_type', 'document_number', 'full_name', 'phone', 'nationality'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Reservation, $this> */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }
}
