<?php

namespace App\Http\Requests;

class InventoryItemRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'name' => [$this->required(), 'string', 'max:120'],
            'unit' => [$this->required(), 'string', 'max:20'],
            // El stock solo se fija al crear; luego cambia con movimientos de entrada/salida.
            'stock' => [$this->isMethod('POST') ? 'sometimes' : 'prohibited', 'integer', 'min:0'],
            'min_stock' => [$this->required(), 'integer', 'min:0'],
        ];
    }
}
