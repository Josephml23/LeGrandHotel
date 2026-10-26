<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Stay extends Model
{
    use Auditable;

    protected $fillable = ['reservation_id', 'checked_in_at', 'checked_out_at'];

    protected function casts(): array
    {
        return ['checked_in_at' => 'datetime', 'checked_out_at' => 'datetime'];
    }

    /** @return BelongsTo<Reservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /** @return HasMany<ParkingAssignment, $this> */
    public function parkingAssignments(): HasMany
    {
        return $this->hasMany(ParkingAssignment::class);
    }
}
