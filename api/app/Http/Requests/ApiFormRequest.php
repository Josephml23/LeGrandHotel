<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Base de los FormRequest de los CRUD: en POST los campos son obligatorios,
 * en PUT/PATCH solo se validan los que lleguen (actualización parcial).
 */
abstract class ApiFormRequest extends FormRequest
{
    protected function required(): string
    {
        return $this->isMethod('POST') ? 'required' : 'sometimes';
    }

    /** Id del recurso de la ruta, para ignorarlo en reglas unique. */
    protected function routeId(string $parameter): ?int
    {
        $value = $this->route($parameter);

        return is_object($value) ? $value->getKey() : ($value ? (int) $value : null);
    }
}
