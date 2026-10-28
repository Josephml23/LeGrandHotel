<?php

namespace App\Http\Requests\Auth;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Registro de una cuenta del personal. Lo usan el Administrador y el Programador (ver routes/api.php);
 * ninguno crea Programadores (solo existe uno). Los clientes no se registran aquí: entran con Google.
 */
class RegisterRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
            'role' => ['required', Rule::in(Role::ASSIGNABLE)],
        ];
    }

    public function messages(): array
    {
        return [
            'role.in' => __('No puedes crear cuentas con ese rol.'),
        ];
    }
}
