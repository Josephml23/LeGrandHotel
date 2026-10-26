<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property Carbon $check_in
 * @property Carbon $check_out
 */
class Reservation extends Model
{
    use Auditable, HasFactory;

    public const PENDING = 'pending';

    public const CONFIRMED = 'confirmed';

    public const CHECKED_IN = 'checked_in';

    public const COMPLETED = 'completed';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [self::PENDING, self::CONFIRMED, self::CHECKED_IN, self::COMPLETED, self::CANCELLED];

    /** Estados que ocupan la habitación en el calendario. */
    public const BLOCKING = [self::PENDING, self::CONFIRMED, self::CHECKED_IN];

    protected $fillable = ['client_id', 'room_id', 'check_in', 'check_out', 'guests', 'status', 'total', 'notes'];

    protected $attributes = ['status' => self::CONFIRMED, 'guests' => 1];

    protected function casts(): array
    {
        return [
            'check_in' => 'date:Y-m-d',
            'check_out' => 'date:Y-m-d',
            'guests' => 'integer',
            'total' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<Client, $this> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** @return HasOne<Stay, $this> */
    public function stay(): HasOne
    {
        return $this->hasOne(Stay::class);
    }

    /**
     * Reservas activas cuyas fechas se cruzan con [from, to). El día de salida queda libre.
     */
    public function scopeOverlapping(Builder $query, string $from, string $to): Builder
    {
        return $query
            ->whereIn('status', self::BLOCKING)
            ->where('check_in', '<', $to)
            ->where('check_out', '>', $from);
    }
}
