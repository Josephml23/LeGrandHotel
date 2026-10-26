<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\ParkingSpot;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Stay;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StayController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $stays = Stay::query()
            ->with(['reservation:id,client_id,room_id,check_in,check_out,status', 'reservation.client:id,full_name', 'reservation.room:id,number'])
            ->when($request->boolean('active'), fn ($q) => $q->whereNull('checked_out_at'))
            ->latest('checked_in_at')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($stays);
    }

    public function show(Stay $stay): JsonResponse
    {
        return ApiResponse::success($stay->load('reservation.client', 'reservation.room.roomType', 'parkingAssignments.parkingSpot'));
    }

    /** POST /stays/{id}/check-out: libera la habitación (pasa a limpieza) y la cochera. */
    public function checkOut(Stay $stay): JsonResponse
    {
        $stay = DB::transaction(function () use ($stay) {
            $stay = Stay::lockForUpdate()->findOrFail($stay->id);

            if ($stay->checked_out_at) {
                throw ApiException::conflict('ALREADY_CHECKED_OUT', 'Esta estadía ya registró su salida.');
            }

            $stay->update(['checked_out_at' => now()]);
            $stay->reservation->update(['status' => Reservation::COMPLETED]);
            $stay->reservation->room()->update(['status' => Room::CLEANING]);

            foreach ($stay->parkingAssignments()->whereNull('left_at')->get() as $assignment) {
                $assignment->update(['left_at' => now()]);
                $assignment->parkingSpot()->update(['status' => ParkingSpot::FREE]);
            }

            return $stay;
        });

        return ApiResponse::success($stay->load('reservation.room', 'reservation.client'));
    }
}
