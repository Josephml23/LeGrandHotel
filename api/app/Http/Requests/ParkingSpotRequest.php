<?php

namespace App\Http\Requests;

use App\Models\ParkingSpot;
use Illuminate\Validation\Rule;

class ParkingSpotRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'code' => [$this->required(), 'string', 'max:10', Rule::unique('parking_spots')->ignore($this->routeId('parking_spot'))],
            'status' => ['sometimes', Rule::in(ParkingSpot::STATUSES)],
        ];
    }
}
