<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class UserRolesRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['required', Rule::in([...Role::INTERNAL, Role::CLIENT])],
            // Hace falta al pasar una cuenta de cliente al personal: el cliente entra con Google y
            // no tiene contraseña, así que sin ella la cuenta se quedaría sin forma de entrar.
            'password' => ['sometimes', 'nullable', Password::min(8)->letters()->numbers()],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $roles = (array) $this->input('roles', []);

            // Un huésped no es personal: el rol de Cliente no se combina con los demás.
            if (in_array(Role::CLIENT, $roles, true) && count($roles) > 1) {
                $validator->errors()->add('roles', __('El rol de Cliente no se combina con los del personal: elige uno u otro.'));
            }
        });
    }
}
