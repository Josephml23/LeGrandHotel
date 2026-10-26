<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\RoomRequest;
use App\Models\Room;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoomController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', Rule::in(Room::STATUSES)],
            'room_type_id' => ['nullable', 'integer'],
            'floor' => ['nullable', 'integer'],
        ]);

        $rooms = Room::query()
            ->with('roomType:id,name,capacity,price_per_night')
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('room_type_id'), fn ($q, $v) => $q->where('room_type_id', $v))
            ->when($request->filled('floor'), fn ($q) => $q->where('floor', $request->integer('floor')))
            ->when($request->query('search'), fn ($q, $s) => $q->where('number', 'like', $this->like($s)))
            ->orderBy('number')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($rooms);
    }

    /** GET /rooms/available?from=&to=&guests= */
    public function available(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after:from'],
            'guests' => ['nullable', 'integer', 'min:1'],
            'room_type_id' => ['nullable', 'integer'],
        ]);

        $rooms = Room::query()
            ->with('roomType:id,name,capacity,price_per_night')
            ->availableBetween($data['from'], $data['to'])
            ->when($data['guests'] ?? null, fn ($q, $g) => $q->whereHas('roomType', fn ($t) => $t->where('capacity', '>=', $g)))
            ->when($data['room_type_id'] ?? null, fn ($q, $v) => $q->where('room_type_id', $v))
            ->orderBy('number')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($rooms);
    }

    public function store(RoomRequest $request): JsonResponse
    {
        $room = Room::create($request->validated());

        return ApiResponse::created($room->load('roomType'));
    }

    public function show(Room $room): JsonResponse
    {
        return ApiResponse::success($room->load('roomType'));
    }

    public function update(RoomRequest $request, Room $room): JsonResponse
    {
        $room->update($request->validated());

        return ApiResponse::success($room->load('roomType'));
    }

    public function updateStatus(Request $request, Room $room): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(Room::STATUSES)]]);
        $room->update($data);

        return ApiResponse::success($room->load('roomType'));
    }

    public function destroy(Room $room): JsonResponse
    {
        if ($room->reservations()->exists()) {
            throw ApiException::conflict('ROOM_HAS_RESERVATIONS', 'No se puede eliminar: la habitación tiene reservas. Ponla en mantenimiento.');
        }

        $room->delete();

        return ApiResponse::noContent();
    }
}
