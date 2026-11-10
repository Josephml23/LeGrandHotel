<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/** El usuario terminó el tutorial de bienvenida o lo omitió; en ambos casos ya no se le vuelve a ofrecer. */
class TutorialRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'outcome' => ['required', Rule::in(['completed', 'skipped'])],
        ];
    }
}
