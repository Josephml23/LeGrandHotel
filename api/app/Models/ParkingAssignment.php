<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingAssignment extends Model
{
    use Auditable;

    protected $fillable = ['parking_spot_id', 'stay_id', 'plate', 'entered_at', 'left_at'];

    protected function casts(): array
    {
        return ['entered_at' => 'datetime', 'left_at' => 'datetime'];
    }

    /** @return BelongsTo<ParkingSpot, $this> */
    public function parkingSpot(): BelongsTo
    {
        return $this->belongsTo(ParkingSpot::class);
    }

    /** @return BelongsTo<Stay, $this> */
    public function stay(): BelongsTo
    {
        return $this->belongsTo(Stay::class);
    }
}
