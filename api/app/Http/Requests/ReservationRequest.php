<?php

namespace App\Http\Requests;

use App\Models\Reservation;
use App\Models\Role;
use Illuminate\Validation\Rule;

class ReservationRequest extends ApiFormRequest
{
    public function rules(): array
    {
        $isClient = $this->user()->hasRole(Role::CLIENT) && ! $this->user()->hasRole(Role::ADMIN, Role::RECEPTIONIST);

        return [
            // Un cliente siempre reserva a su nombre; el personal elige el huésped.
            'client_id' => [$isClient ? 'prohibited' : $this->required(), 'integer', 'exists:clients,id'],
            'room_id' => [$this->required(), 'integer', 'exists:rooms,id'],
            'check_in' => [$this->required(), 'date_format:Y-m-d', ...($this->isMethod('POST') ? ['after_or_equal:today'] : [])],
            'check_out' => [$this->required(), 'date_format:Y-m-d', 'after:check_in'],
            'guests' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'status' => ['sometimes', Rule::in($isClient ? [Reservation::CANCELLED] : [Reservation::PENDING, Reservation::CONFIRMED, Reservation::CANCELLED])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
