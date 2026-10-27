<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReservationRequest;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\Stay;
use App\Services\ReservationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReservationController extends Controller
{
    public function __construct(private readonly ReservationService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Reservation::class);
        $request->validate([
            'status' => ['nullable', Rule::in(Reservation::STATUSES)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'check_in' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $reservations = Reservation::query()
            ->with(['client:id,full_name,document_number', 'room:id,number,room_type_id', 'room.roomType:id,name', 'stay'])
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('client_id'), fn ($q, $v) => $q->where('client_id', $v))
            ->when($request->query('room_id'), fn ($q, $v) => $q->where('room_id', $v))
            ->when($request->query('check_in'), fn ($q, $v) => $q->whereDate('check_in', $v))
            ->when($request->query('from'), fn ($q, $v) => $q->where('check_out', '>', $v))
            ->when($request->query('to'), fn ($q, $v) => $q->where('check_in', '<', $v))
            ->when($request->query('search'), fn ($q, $s) => $q->whereHas('client', fn ($c) => $c
                ->where('full_name', 'like', $this->like($s))
                ->orWhere('document_number', 'like', addcslashes($s, '%_\\').'%')))
            ->orderByDesc('check_in')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($reservations);
    }

    public function store(ReservationRequest $request): JsonResponse
    {
        $this->authorize('create', Reservation::class);

        return ApiResponse::created($this->service->save($request->validated()));
    }

    public function show(Reservation $reservation): JsonResponse
    {
        $this->authorize('view', $reservation);

        return ApiResponse::success($reservation->load(['client', 'room.roomType', 'stay.parkingAssignments']));
    }

    public function update(ReservationRequest $request, Reservation $reservation): JsonResponse
    {
        $this->authorize('update', $reservation);

        if (in_array($reservation->status, [Reservation::CHECKED_IN, Reservation::COMPLETED], true)) {
            throw ApiException::conflict('RESERVATION_LOCKED', 'No se puede modificar una reserva en curso o finalizada.');
        }

        $data = [
            'room_id' => $reservation->room_id,
            'check_in' => $reservation->check_in->toDateString(),
            'check_out' => $reservation->check_out->toDateString(),
            ...$request->validated(),
        ];

        return ApiResponse::success($this->service->save($data, $reservation));
    }

    public function destroy(Reservation $reservation): JsonResponse
    {
        $this->authorize('delete', $reservation);

        if ($reservation->stay()->exists()) {
            throw ApiException::conflict('RESERVATION_HAS_STAY', 'No se puede eliminar una reserva con estadía registrada.');
        }

        $reservation->delete();

        return ApiResponse::noContent();
    }

    /** POST /reservations/{id}/check-in */
    public function checkIn(Reservation $reservation): JsonResponse
    {
        $this->authorize('manageStay', $reservation);

        $stay = DB::transaction(function () use ($reservation) {
            $reservation = Reservation::lockForUpdate()->findOrFail($reservation->id);

            if (! in_array($reservation->status, [Reservation::PENDING, Reservation::CONFIRMED], true)) {
                throw ApiException::conflict('INVALID_RESERVATION_STATUS', "No se puede hacer check-in de una reserva en estado {$reservation->status}.");
            }

            $stay = Stay::create(['reservation_id' => $reservation->id, 'checked_in_at' => now()]);
            $reservation->update(['status' => Reservation::CHECKED_IN]);
            $reservation->room()->update(['status' => Room::OCCUPIED]);

            return $stay;
        });

        return ApiResponse::created($stay->load('reservation.room', 'reservation.client'));
    }
}
