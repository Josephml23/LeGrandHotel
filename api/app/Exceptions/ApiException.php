<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Error de negocio esperado (409 por doble reserva, stock insuficiente, etc.).
 */
class ApiException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 400,
        public readonly mixed $details = null,
    ) {
        parent::__construct($message);
    }

    public static function conflict(string $code, string $message, mixed $details = null): self
    {
        return new self($code, $message, 409, $details);
    }
}
