<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoomType extends Model
{
    use Auditable, HasFactory;

    protected $fillable = ['name', 'description', 'capacity', 'price_per_night'];

    protected function casts(): array
    {
        return ['capacity' => 'integer', 'price_per_night' => 'decimal:2'];
    }

    /** @return HasMany<Room, $this> */
    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }
}
