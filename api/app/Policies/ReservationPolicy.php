<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\Role;
use App\Models\User;

/**
 * Las reservas las gestionan Administración y Recepción. Los huéspedes no tienen cuenta en el sistema.
 */
class ReservationPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isFrontDesk($user);
    }

    public function view(User $user, Reservation $reservation): bool
    {
        return $this->isFrontDesk($user);
    }

    public function create(User $user): bool
    {
        return $this->isFrontDesk($user);
    }

    public function update(User $user, Reservation $reservation): bool
    {
        return $this->isFrontDesk($user);
    }

    public function delete(User $user, Reservation $reservation): bool
    {
        return $this->isFrontDesk($user);
    }

    public function manageStay(User $user, Reservation $reservation): bool
    {
        return $this->isFrontDesk($user);
    }

    private function isFrontDesk(User $user): bool
    {
        return $user->hasRole(Role::ADMIN, Role::RECEPTIONIST);
    }
}
