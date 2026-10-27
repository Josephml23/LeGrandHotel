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
            'full_name' => [$this->required(), 'string', 'max:120'],
            'document_type' => [$this->required(), Rule::in(Client::DOCUMENT_TYPES)],
            'document_number' => [$this->required(), 'string', 'max:20', Rule::unique('clients')->ignore($clientId)],
            'phone' => ['nullable', 'string', 'max:30'],
            'nationality' => ['nullable', 'string', 'max:60'],
        ];
    }
}
