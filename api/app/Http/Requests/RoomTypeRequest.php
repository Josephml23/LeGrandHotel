<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class RoomTypeRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'name' => [$this->required(), 'string', 'max:80', Rule::unique('room_types')->ignore($this->routeId('room_type'))],
            'description' => ['nullable', 'string', 'max:1000'],
            'capacity' => [$this->required(), 'integer', 'min:1', 'max:20'],
            'price_per_night' => [$this->required(), 'numeric', 'min:0', 'max:99999'],
        ];
    }
}
