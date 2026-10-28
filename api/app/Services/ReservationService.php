<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Reservation;
use App\Models\Room;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ReservationService
{
    /** Noches entre la entrada y la salida (la salida no se cobra). */
    public function nights(string $checkIn, string $checkOut): int
    {
        return (int) CarbonImmutable::parse($checkIn)->startOfDay()
            ->diffInDays(CarbonImmutable::parse($checkOut)->startOfDay());
    }

    public function calculateTotal(float|string $pricePerNight, string $checkIn, string $checkOut): string
    {
        $nights = $this->nights($checkIn, $checkOut);

        return number_format(round((float) $pricePerNight * $nights, 2), 2, '.', '');
    }

    public function isAvailable(int $roomId, string $from, string $to, ?int $ignoreReservationId = null): bool
    {
        return ! Reservation::query()
            ->where('room_id', $roomId)
            ->when($ignoreReservationId, fn ($q) => $q->whereKeyNot($ignoreReservationId))
            ->overlapping($from, $to)
            ->exists();
    }

    /**
     * Crea o actualiza una reserva bloqueando la fila de la habitación para que
     * dos peticiones simultáneas no puedan reservar las mismas fechas.
     */
    public function save(array $data, ?Reservation $reservation = null): Reservation
    {
        return DB::transaction(function () use ($data, $reservation) {
            $room = Room::with('roomType')->lockForUpdate()->findOrFail($data['room_id']);

            if ($room->status === Room::MAINTENANCE) {
                throw ApiException::conflict('ROOM_UNDER_MAINTENANCE', 'La habitación está en mantenimiento.');
            }

            $guests = (int) ($data['guests'] ?? $reservation->guests ?? 1);
            if ($guests > $room->roomType->capacity) {
                throw new ApiException('CAPACITY_EXCEEDED', __('La habitación admite máximo :capacity huéspedes.', ['capacity' => $room->roomType->capacity]), 422, [
                    'guests' => [__('Máximo :capacity huéspedes.', ['capacity' => $room->roomType->capacity])],
                ]);
            }

            $status = $data['status'] ?? $reservation->status ?? Reservation::CONFIRMED;
            if (in_array($status, Reservation::BLOCKING, true)
                && ! $this->isAvailable($room->id, $data['check_in'], $data['check_out'], $reservation?->id)) {
                throw ApiException::conflict('ROOM_ALREADY_BOOKED', 'La habitación ya está reservada en esas fechas.', [
                    'room_id' => $room->id,
                    'check_in' => $data['check_in'],
                    'check_out' => $data['check_out'],
                ]);
            }

            $data['guests'] = $guests;
            $data['status'] = $status;
            $data['total'] = $this->calculateTotal($room->roomType->price_per_night, $data['check_in'], $data['check_out']);

            $reservation ??= new Reservation;
            $reservation->fill($data)->save();

            return $reservation->load(['client', 'room.roomType']);
        });
    }
}
