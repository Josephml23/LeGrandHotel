<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $logs = AuditLog::query()
            ->with('user:id,name')
            ->when($request->query('entity'), fn ($q, $v) => $q->where('entity', $v))
            ->when($request->query('action'), fn ($q, $v) => $q->where('action', $v))
            ->when($request->query('user_id'), fn ($q, $v) => $q->where('user_id', $v))
            ->latest('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($logs);
    }
}
