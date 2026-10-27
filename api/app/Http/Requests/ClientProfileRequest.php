<?php

namespace App\Http\Requests;

/**
 * Datos que el cliente completa la primera vez que entra con Google: DNI y teléfono.
 */
class ClientProfileRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'document_number' => ['required', 'digits:8'],
            'phone' => ['required', 'regex:/^9\d{8}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'document_number.digits' => 'El DNI debe tener 8 dígitos.',
            'phone.regex' => 'El teléfono debe tener 9 dígitos y empezar con 9.',
        ];
    }
}
