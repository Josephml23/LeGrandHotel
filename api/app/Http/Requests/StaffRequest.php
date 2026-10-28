<?php

namespace App\Http\Requests;

use App\Models\Role;
use App\Models\Staff;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StaffRequest extends ApiFormRequest
{
    public function rules(): array
    {
        $staff = $this->route('staff');
        $userId = $staff instanceof Staff ? $staff->user_id : null;

        return [
            'name' => [$this->required(), 'string', 'max:120'],
            'email' => [$this->required(), 'email', 'max:255', Rule::unique('users')->ignore($userId)],
            'password' => [$this->isMethod('POST') ? 'required' : 'sometimes', Password::min(8)->letters()->numbers()],
            // Al crear no se ofrece Programador (es único); al editar su ficha se acepta para conservarlo.
            'role' => [$this->required(), Rule::in($this->isMethod('POST') ? Role::ASSIGNABLE : Role::INTERNAL)],
            'position' => [$this->required(), 'string', 'max:60'],
            'shift' => [$this->required(), Rule::in(Staff::SHIFTS)],
            'hired_at' => [$this->required(), 'date_format:Y-m-d', 'before_or_equal:today'],
        ];
    }
}
