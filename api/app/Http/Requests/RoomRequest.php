<?php

namespace App\Http\Requests;

use App\Models\Room;
use Illuminate\Validation\Rule;

class RoomRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'room_type_id' => [$this->required(), 'integer', 'exists:room_types,id'],
            'number' => [$this->required(), 'string', 'max:10', Rule::unique('rooms')->ignore($this->routeId('room'))],
            'floor' => [$this->required(), 'integer', 'min:0', 'max:200'],
            'status' => ['sometimes', Rule::in(Room::STATUSES)],
        ];
    }
}
