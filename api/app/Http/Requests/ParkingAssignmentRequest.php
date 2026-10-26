<?php

namespace App\Http\Requests;

class ParkingAssignmentRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'parking_spot_id' => [$this->required(), 'integer', 'exists:parking_spots,id'],
            'stay_id' => ['nullable', 'integer', 'exists:stays,id'],
            'plate' => [$this->required(), 'string', 'max:15', 'regex:/^[A-Za-z0-9-]+$/'],
            'entered_at' => ['sometimes', 'date'],
            'left_at' => ['nullable', 'date', 'after_or_equal:entered_at'],
        ];
    }
}
