<?php

namespace App\Http\Requests;

/**
 * Reserva hecha por el propio cliente: elige el tipo de habitación y el sistema asigna una libre.
 */
class ClientBookingRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'room_type_id' => ['required', 'integer', 'exists:room_types,id'],
            'check_in' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'check_out' => ['required', 'date_format:Y-m-d', 'after:check_in'],
            'guests' => ['required', 'integer', 'min:1', 'max:20'],
        ];
    }
}
