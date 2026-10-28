<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ParkingAssignmentRequest;
use App\Models\ParkingAssignment;
use App\Models\ParkingSpot;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ParkingAssignmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $assignments = ParkingAssignment::query()
            ->with(['parkingSpot:id,code', 'stay.reservation.client:id,full_name', 'stay.reservation.room:id,number'])
            ->when($request->boolean('active'), fn ($q) => $q->whereNull('left_at'))
            ->when($request->query('search'), fn ($q, $s) => $q->where('plate', 'like', $this->like(Str::upper($s))))
            ->latest('entered_at')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($assignments);
    }

    public function store(ParkingAssignmentRequest $request): JsonResponse
    {
        $assignment = DB::transaction(function () use ($request) {
            $spot = ParkingSpot::lockForUpdate()->findOrFail($request->integer('parking_spot_id'));

            if ($spot->status !== ParkingSpot::FREE) {
                throw ApiException::conflict('PARKING_SPOT_NOT_FREE', __('El espacio :code no está libre.', ['code' => $spot->code]));
            }

            $assignment = ParkingAssignment::create([
                ...$request->validated(),
                'plate' => Str::upper($request->string('plate')),
                'entered_at' => $request->input('entered_at', now()),
                'left_at' => null,
            ]);
            $spot->update(['status' => ParkingSpot::OCCUPIED]);

            return $assignment;
        });

        return ApiResponse::created($assignment->load('parkingSpot'));
    }

    public function show(ParkingAssignment $parkingAssignment): JsonResponse
    {
        return ApiResponse::success($parkingAssignment->load('parkingSpot', 'stay.reservation.client'));
    }

    /** Registrar la salida (left_at) libera el espacio. */
    public function update(ParkingAssignmentRequest $request, ParkingAssignment $parkingAssignment): JsonResponse
    {
        DB::transaction(function () use ($request, $parkingAssignment) {
            $data = $request->validated();
            $leaving = $parkingAssignment->left_at === null && ! empty($data['left_at']);
            if (isset($data['plate'])) {
                $data['plate'] = Str::upper($data['plate']);
            }
            unset($data['parking_spot_id']);

            $parkingAssignment->update($data);

            if ($leaving) {
                $parkingAssignment->parkingSpot()->update(['status' => ParkingSpot::FREE]);
            }
        });

        return ApiResponse::success($parkingAssignment->fresh('parkingSpot'));
    }

    public function destroy(ParkingAssignment $parkingAssignment): JsonResponse
    {
        DB::transaction(function () use ($parkingAssignment) {
            if ($parkingAssignment->left_at === null) {
                $parkingAssignment->parkingSpot()->update(['status' => ParkingSpot::FREE]);
            }
            $parkingAssignment->delete();
        });

        return ApiResponse::noContent();
    }
}
