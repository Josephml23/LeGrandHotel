<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    use Auditable, HasFactory;

    public const AVAILABLE = 'available';

    public const OCCUPIED = 'occupied';

    public const CLEANING = 'cleaning';

    public const MAINTENANCE = 'maintenance';

    public const STATUSES = [self::AVAILABLE, self::OCCUPIED, self::CLEANING, self::MAINTENANCE];

    protected $fillable = ['room_type_id', 'number', 'floor', 'status'];

    protected $attributes = ['status' => self::AVAILABLE];

    protected function casts(): array
    {
        return ['floor' => 'integer'];
    }

    /** @return BelongsTo<RoomType, $this> */
    public function roomType(): BelongsTo
    {
        return $this->belongsTo(RoomType::class);
    }

    /** @return HasMany<Reservation, $this> */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    /**
     * Habitaciones sin reservas activas que se crucen con [from, to).
     */
    public function scopeAvailableBetween(Builder $query, string $from, string $to): Builder
    {
        return $query
            ->where('status', '!=', self::MAINTENANCE)
            ->whereNotIn('id', Reservation::query()->overlapping($from, $to)->select('room_id'));
    }
}
