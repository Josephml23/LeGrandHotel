<?php

namespace App\Http\Requests;

use App\Models\InventoryMovement;
use Illuminate\Validation\Rule;

class InventoryMovementRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in([InventoryMovement::IN, InventoryMovement::OUT])],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
