<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ClientBookingRequest;
use App\Http\Requests\ClientProfileRequest;
use App\Models\Client;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use App\Services\ReservationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Portal del cliente (rol client, entra con Google): completa sus datos, ve los tipos de habitación
 * disponibles, reserva y cancela solo sus propias reservas.
 */
class ClientPortalController extends Controller
{
    public function __construct(private readonly ReservationService $reservations) {}

    /**
     * Guarda el nombre completo y, si los da, el DNI y el celular (pueden quedar para después).
     * Si recepción ya tenía una ficha con ese DNI, se enlaza esa en vez de duplicarla.
     */
    public function saveProfile(ClientProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validated();
        $document = $data['document_number'] ?? null;

        DB::transaction(function () use ($user, $data, $document) {
            $own = $user->client()->first();
            $byDocument = $document ? Client::where('document_number', $document)->lockForUpdate()->first() : null;

            if ($byDocument && ! $byDocument->is($own)) {
                // La ficha de recepción se puede tomar si no es de otra cuenta y la propia todavía no tiene reservas.
                $takenByOther = $byDocument->user_id !== null && $byDocument->user_id !== $user->id;
                if ($takenByOther || ($own && $own->reservations()->exists())) {
                    throw ApiException::conflict('DOCUMENT_ALREADY_LINKED', 'Ese DNI ya está asociado a otra cuenta. Acércate a recepción para revisarlo.');
                }
                $own?->delete();
                $own = $byDocument;
            }

            $client = $own ?? new Client;
            $client->fill([
                'full_name' => $data['full_name'],
                'document_type' => $document ? 'DNI' : $client->document_type,
                'document_number' => $document,
                'phone' => $data['phone'] ?? null,
            ]);
            $client->user_id = $user->id;
            $client->save();

            $user->update(['name' => $data['full_name']]);
        });

        return ApiResponse::success(AuthController::userPayloadFor($user->fresh()));
    }

    /**
     * Tipos de habitación con capacidad suficiente, sus servicios, cuántas habitaciones quedan libres
     * en esas fechas y el total de la estadía.
     */
    public function roomTypes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'to' => ['required', 'date_format:Y-m-d', 'after:from'],
            'guests' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);
        $nights = $this->reservations->nights($data['from'], $data['to']);

        $types = RoomType::query()
            ->where('capacity', '>=', $data['guests'] ?? 1)
            ->withCount(['rooms as available_rooms' => fn ($q) => $q->availableBetween($data['from'], $data['to'])])
            ->orderBy('price_per_night')
            ->paginate($this->perPage($request))
            ->through(fn (RoomType $type): array => [
                'id' => $type->id,
                'name' => $type->name,
                'description' => $type->description,
                'amenities' => $type->amenities ?? [],
                'capacity' => $type->capacity,
                'price_per_night' => $type->price_per_night,
                'available_rooms' => (int) $type->getAttribute('available_rooms'),
                'nights' => $nights,
                'total' => $this->reservations->calculateTotal($type->price_per_night, $data['from'], $data['to']),
            ]);

        return ApiResponse::paginated($types);
    }

    public function reservations(Request $request): JsonResponse
    {
        $clientId = $request->user()->client?->id;

        $reservations = Reservation::query()
            ->where('client_id', $clientId ?? 0)
            ->with('room.roomType:id,name,amenities')
            ->orderByDesc('check_in')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($reservations);
    }

    /**
     * El cliente elige el tipo; se le asigna la primera habitación libre de ese tipo.
     */
    public function book(ClientBookingRequest $request): JsonResponse
    {
        // Se reserva a nombre del cliente: hacen falta su nombre, DNI y celular (la web los pide si faltan).
        $client = $request->user()->client;
        if (! $client || ! $client->document_number || ! $client->phone) {
            throw ApiException::conflict('PROFILE_INCOMPLETE', 'Completa tu nombre, DNI y celular antes de reservar.');
        }
        $data = $request->validated();

        $candidates = Room::query()
            ->where('room_type_id', $data['room_type_id'])
            ->availableBetween($data['check_in'], $data['check_out'])
            ->orderBy('number')
            ->pluck('id');

        foreach ($candidates as $roomId) {
            try {
                $reservation = $this->reservations->save([
                    'client_id' => $client->id,
                    'room_id' => $roomId,
                    'check_in' => $data['check_in'],
                    'check_out' => $data['check_out'],
                    'guests' => $data['guests'],
                    'status' => Reservation::CONFIRMED,
                    'notes' => 'Reserva hecha por el cliente en línea.',
                ]);

                return ApiResponse::created($reservation);
            } catch (ApiException $e) {
                // Otra persona tomó esta habitación en el mismo instante: se prueba con la siguiente.
                if ($e->errorCode !== 'ROOM_ALREADY_BOOKED') {
                    throw $e;
                }
            }
        }

        throw ApiException::conflict('NO_ROOMS_AVAILABLE', 'Ya no quedan habitaciones de ese tipo en esas fechas.');
    }

    public function cancel(Request $request, Reservation $reservation): JsonResponse
    {
        $this->authorize('cancelOwn', $reservation);

        if (! in_array($reservation->status, [Reservation::PENDING, Reservation::CONFIRMED], true)
            || ! $reservation->check_in->isAfter(today())) {
            throw ApiException::conflict('CANNOT_CANCEL', 'Solo puedes cancelar reservas confirmadas antes del día de llegada.');
        }

        $reservation->update(['status' => Reservation::CANCELLED]);

        return ApiResponse::success($reservation->load('room.roomType:id,name,amenities'));
    }
}
