<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'name' => [$this->required(), 'string', 'max:120'],
            'email' => [$this->required(), 'email', 'max:255', Rule::unique('users')->ignore($this->routeId('user'))],
            'password' => [$this->isMethod('POST') ? 'required' : 'sometimes', Password::min(8)->letters()->numbers()],
            'roles' => [$this->isMethod('POST') ? 'required' : 'prohibited', 'array', 'min:1'],
            'roles.*' => [Rule::in(array_keys(Role::LABELS))],
        ];
    }
}
