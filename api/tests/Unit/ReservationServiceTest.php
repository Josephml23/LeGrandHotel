<?php

use App\Models\Reservation;
use App\Models\Room;
use App\Services\ReservationService;

beforeEach(fn () => $this->service = new ReservationService);

describe('cálculo del total', function () {
    it('cobra precio por noche por cada noche', function () {
        expect($this->service->calculateTotal(150, '2026-11-01', '2026-11-04'))->toBe('450.00');
    });

    it('no cobra el día de salida', function () {
        expect($this->service->nights('2026-11-01', '2026-11-02'))->toBe(1);
    });

    it('redondea a dos decimales', function () {
        expect($this->service->calculateTotal('99.999', '2026-11-01', '2026-11-03'))->toBe('200.00');
    });
});

describe('disponibilidad de habitaciones', function () {
    beforeEach(function () {
        $this->room = Room::factory()->create();
        Reservation::factory()->for($this->room)->create([
            'check_in' => '2026-12-10',
            'check_out' => '2026-12-15',
        ]);
    });

    it('detecta fechas que se cruzan', function (string $from, string $to) {
        expect($this->service->isAvailable($this->room->id, $from, $to))->toBeFalse();
    })->with([
        'dentro' => ['2026-12-11', '2026-12-13'],
        'cubre todo' => ['2026-12-08', '2026-12-20'],
        'empieza antes' => ['2026-12-08', '2026-12-11'],
        'termina después' => ['2026-12-14', '2026-12-18'],
    ]);

    it('permite entrar el mismo día que sale el huésped anterior', function () {
        expect($this->service->isAvailable($this->room->id, '2026-12-15', '2026-12-17'))->toBeTrue();
        expect($this->service->isAvailable($this->room->id, '2026-12-05', '2026-12-10'))->toBeTrue();
    });

    it('ignora reservas canceladas', function () {
        Reservation::query()->update(['status' => Reservation::CANCELLED]);

        expect($this->service->isAvailable($this->room->id, '2026-12-11', '2026-12-13'))->toBeTrue();
    });
});
