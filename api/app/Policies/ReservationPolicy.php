<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\Role;
use App\Models\User;

/**
 * Admin y Recepción gestionan todas las reservas; el Cliente solo ve y cancela las suyas.
 */
class ReservationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::ADMIN, Role::RECEPTIONIST, Role::CLIENT);
    }

    public function view(User $user, Reservation $reservation): bool
    {
        return $this->isStaff($user) || $this->owns($user, $reservation);
    }

    /** El cliente debe haber verificado su correo antes de reservar. */
    public function create(User $user): bool
    {
        return $this->isStaff($user)
            || ($user->hasRole(Role::CLIENT) && $user->hasVerifiedEmail());
    }

    public function update(User $user, Reservation $reservation): bool
    {
        return $this->isStaff($user) || $this->owns($user, $reservation);
    }

    public function delete(User $user, Reservation $reservation): bool
    {
        return $this->isStaff($user);
    }

    public function manageStay(User $user, Reservation $reservation): bool
    {
        return $this->isStaff($user);
    }

    private function isStaff(User $user): bool
    {
        return $user->hasRole(Role::ADMIN, Role::RECEPTIONIST);
    }

    private function owns(User $user, Reservation $reservation): bool
    {
        return $user->client !== null && $reservation->client_id === $user->client->id;
    }
}
