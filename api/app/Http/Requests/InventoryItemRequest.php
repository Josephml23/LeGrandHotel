<?php

namespace App\Http\Requests;

use App\Models\InventoryItem;
use Illuminate\Validation\Rule;

class InventoryItemRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'name' => [$this->required(), 'string', 'max:120'],
            // La unidad se elige de una lista y no se cambia después: el stock está medido en ella.
            'unit' => [$this->isMethod('POST') ? 'required' : 'prohibited', Rule::in(InventoryItem::UNITS)],
            // El stock solo se fija al crear; luego cambia con movimientos de entrada/salida.
            'stock' => [$this->isMethod('POST') ? 'sometimes' : 'prohibited', 'integer', 'min:0'],
            'min_stock' => [$this->required(), 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return ['unit.prohibited' => __('La unidad no se puede cambiar: el stock está medido en ella.')];
    }
}
