<?php

namespace App\Http\Requests;

use App\Models\Role;
use App\Models\Staff;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Ficha del personal: la cuenta con la que entra y desde cuándo trabaja.
 * El cargo se deduce del rol, así que no se pide aparte.
 */
class StaffRequest extends ApiFormRequest
{
    public function rules(): array
    {
        $staff = $this->route('staff');
        $userId = $staff instanceof Staff ? $staff->user_id : null;

        return [
            'name' => [$this->required(), 'string', 'max:120', self::SOLO_LETRAS],
            'email' => [$this->required(), 'email', 'max:255', Rule::unique('users')->ignore($userId)],
            'password' => [$this->isMethod('POST') ? 'required' : 'sometimes', Password::min(8)->letters()->numbers()],
            // Al crear no se ofrece Programador (es único); al editar su ficha se acepta para conservarlo.
            'role' => [$this->required(), Rule::in($this->isMethod('POST') ? Role::ASSIGNABLE : Role::INTERNAL)],
            'hired_at' => [$this->required(), 'date_format:Y-m-d', 'before_or_equal:today'],
        ];
    }

    public function messages(): array
    {
        return ['name.regex' => __('El nombre solo puede tener letras.')];
    }
}
