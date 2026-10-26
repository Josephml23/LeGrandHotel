<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\RoomTypeRequest;
use App\Models\RoomType;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $types = RoomType::query()
            ->withCount('rooms')
            ->when($request->query('search'), fn ($q, $s) => $q->where('name', 'like', $this->like($s)))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($types);
    }

    public function store(RoomTypeRequest $request): JsonResponse
    {
        return ApiResponse::created(RoomType::create($request->validated()));
    }

    public function show(RoomType $roomType): JsonResponse
    {
        return ApiResponse::success($roomType->loadCount('rooms'));
    }

    public function update(RoomTypeRequest $request, RoomType $roomType): JsonResponse
    {
        $roomType->update($request->validated());

        return ApiResponse::success($roomType);
    }

    public function destroy(RoomType $roomType): JsonResponse
    {
        if ($roomType->rooms()->exists()) {
            throw ApiException::conflict('ROOM_TYPE_IN_USE', 'No se puede eliminar: hay habitaciones de este tipo.');
        }

        $roomType->delete();

        return ApiResponse::noContent();
    }
}
