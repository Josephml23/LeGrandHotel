<?php

namespace App\Http\Requests;

use App\Models\Client;
use Illuminate\Validation\Rule;

class ClientRequest extends ApiFormRequest
{
    public function rules(): array
    {
        $clientId = $this->routeId('client');

        return [
            'full_name' => [$this->required(), 'string', 'max:120', self::SOLO_LETRAS],
            'document_type' => [$this->required(), Rule::in(Client::DOCUMENT_TYPES)],
            'document_number' => [$this->required(), 'string', Rule::unique('clients')->ignore($clientId), ...$this->reglaDelDocumento()],
            'phone' => ['nullable', 'digits_between:6,15'],
            'nationality' => ['nullable', 'string', 'max:60', self::SOLO_LETRAS],
        ];
    }

    /** El DNI y el carné de extranjería son numéricos; el pasaporte lleva letras y números. */
    private function reglaDelDocumento(): array
    {
        return match ($this->input('document_type')) {
            'DNI' => ['digits:8'],
            'CE' => ['digits_between:8,12'],
            default => ['alpha_num', 'max:20'],
        };
    }

    public function messages(): array
    {
        return [
            'full_name.regex' => __('El nombre solo puede tener letras.'),
            'nationality.regex' => __('La nacionalidad solo puede tener letras.'),
            'phone.digits_between' => __('El teléfono solo puede tener números (entre 6 y 15).'),
            'document_number.digits' => __('El DNI debe tener 8 dígitos.'),
            'document_number.digits_between' => __('El carné de extranjería solo puede tener números (entre 8 y 12).'),
            'document_number.alpha_num' => __('El pasaporte solo puede tener letras y números.'),
        ];
    }
}
