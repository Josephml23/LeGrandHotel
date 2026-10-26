<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * Registra en audit_logs quién creó, editó o eliminó cada registro.
 */
trait Auditable
{
    /** Campos que nunca se guardan en el registro de auditoría. */
    protected static array $auditHidden = ['password', 'remember_token', 'google_id', 'updated_at'];

    public static function bootAuditable(): void
    {
        static::created(fn (Model $model) => static::writeAudit($model, 'created', $model->getAttributes()));
        static::updated(fn (Model $model) => static::writeAudit($model, 'updated', $model->getChanges()));
        static::deleted(fn (Model $model) => static::writeAudit($model, 'deleted', null));
    }

    protected static function writeAudit(Model $model, string $action, ?array $changes): void
    {
        if ($changes !== null) {
            $changes = array_diff_key($changes, array_flip(static::$auditHidden));
            if ($action === 'updated' && $changes === []) {
                return;
            }
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'entity' => Str::snake(class_basename($model)),
            'entity_id' => $model->getKey(),
            'changes' => $changes,
            'ip' => app()->runningInConsole() ? null : request()->ip(),
        ]);
    }
}
