<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Staff extends Model
{
    use Auditable, HasFactory;

    public const SHIFTS = ['morning', 'afternoon', 'night'];

    protected $table = 'staff';

    protected $fillable = ['user_id', 'position', 'shift', 'hired_at'];

    protected function casts(): array
    {
        return ['hired_at' => 'date:Y-m-d'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
