<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ParkingSpot extends Model
{
    use Auditable, HasFactory;

    public const FREE = 'free';

    public const OCCUPIED = 'occupied';

    public const MAINTENANCE = 'maintenance';

    public const STATUSES = [self::FREE, self::OCCUPIED, self::MAINTENANCE];

    protected $fillable = ['code', 'status'];

    protected $attributes = ['status' => self::FREE];

    /** @return HasMany<ParkingAssignment, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(ParkingAssignment::class);
    }
}
