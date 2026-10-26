<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ParkingSpotRequest;
use App\Models\ParkingSpot;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParkingSpotController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $spots = ParkingSpot::query()
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('search'), fn ($q, $s) => $q->where('code', 'like', $this->like($s)))
            ->orderBy('code')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($spots);
    }

    public function store(ParkingSpotRequest $request): JsonResponse
    {
        return ApiResponse::created(ParkingSpot::create($request->validated()));
    }

    public function show(ParkingSpot $parkingSpot): JsonResponse
    {
        return ApiResponse::success($parkingSpot);
    }

    public function update(ParkingSpotRequest $request, ParkingSpot $parkingSpot): JsonResponse
    {
        $parkingSpot->update($request->validated());

        return ApiResponse::success($parkingSpot);
    }

    public function destroy(ParkingSpot $parkingSpot): JsonResponse
    {
        if ($parkingSpot->assignments()->exists()) {
            throw ApiException::conflict('PARKING_SPOT_IN_USE', 'No se puede eliminar: el espacio tiene historial de uso.');
        }

        $parkingSpot->delete();

        return ApiResponse::noContent();
    }
}
