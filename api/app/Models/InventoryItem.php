<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    use Auditable, HasFactory;

    protected $fillable = ['name', 'unit', 'stock', 'min_stock'];

    protected $attributes = ['stock' => 0, 'min_stock' => 0];

    protected $appends = ['low_stock'];

    protected function casts(): array
    {
        return ['stock' => 'integer', 'min_stock' => 'integer'];
    }

    /** @return HasMany<InventoryMovement, $this> */
    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    /** Alerta de stock mínimo: se dispara al llegar o bajar del mínimo. */
    public function isBelowMinimum(): bool
    {
        return $this->stock <= $this->min_stock;
    }

    public function getLowStockAttribute(): bool
    {
        return $this->isBelowMinimum();
    }
}
