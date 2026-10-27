<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoomType extends Model
{
    use Auditable, HasFactory;

    protected $fillable = ['name', 'description', 'amenities', 'capacity', 'price_per_night'];

    protected function casts(): array
    {
        // amenities: servicios que el cliente ve al reservar (Wi-Fi, TV, jacuzzi…).
        return ['capacity' => 'integer', 'price_per_night' => 'decimal:2', 'amenities' => 'array'];
    }

    /** @return HasMany<Room, $this> */
    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }
}
