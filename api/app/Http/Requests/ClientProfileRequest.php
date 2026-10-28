<?php

namespace App\Http\Requests;

/**
 * Perfil del cliente que entra con Google: nombre completo (obligatorio), DNI y celular (opcionales).
 * Se completa al registrarse, en «Mi perfil» o justo antes de reservar.
 */
class ClientProfileRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'min:3', 'max:120'],
            'document_number' => ['nullable', 'digits:8'],
            'phone' => ['nullable', 'regex:/^9\d{8}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'document_number.digits' => __('El DNI debe tener 8 dígitos.'),
            'phone.regex' => __('El celular debe tener 9 dígitos y empezar con 9.'),
        ];
    }
}
