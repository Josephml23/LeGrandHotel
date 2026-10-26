<?php

namespace App\Http\Requests\Auth;

use App\Models\Client;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
            'document_type' => ['required', Rule::in(Client::DOCUMENT_TYPES)],
            'document_number' => ['required', 'string', 'max:20', 'unique:clients,document_number'],
            'phone' => ['nullable', 'string', 'max:30'],
            'nationality' => ['nullable', 'string', 'max:60'],
        ];
    }
}
