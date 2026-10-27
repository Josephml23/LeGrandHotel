<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Validation\Rule;

class UserRolesRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['required', Rule::in(Role::INTERNAL)],
        ];
    }
}
