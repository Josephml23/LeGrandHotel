<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\DeveloperController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\GoogleAuthController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\InventoryItemController;
use App\Http\Controllers\Api\ParkingAssignmentController;
use App\Http\Controllers\Api\ParkingSpotController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\RoomTypeController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\StayController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
| Todas las rutas viven bajo /api/v1 (bootstrap/app.php) y responden JSON.
| Sistema interno del hotel. Roles: admin, receptionist, storekeeper, developer.
| No hay registro público: el Administrador registra las cuentas del personal.
*/

// ── Público ─────────────────────────────────────────────
Route::get('health', HealthController::class)->name('health');

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::get('google/redirect', [GoogleAuthController::class, 'redirect']);
    Route::get('google/callback', [GoogleAuthController::class, 'callback']);
});

Route::get('email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware(['signed', 'throttle:6,1'])
    ->name('verification.verify');

// ── Autenticado (Sanctum, token Bearer con vencimiento) ─
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::prefix('auth')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('refresh', [AuthController::class, 'refresh']);
        // Registro interno: solo el Administrador crea cuentas (3 por minuto).
        Route::post('register', [AuthController::class, 'register'])->middleware(['role:admin', 'throttle:register']);
    });
    Route::post('email/verification-notification', [EmailVerificationController::class, 'send'])->middleware('throttle:6,1');

    Route::get('dashboard', [ReportController::class, 'dashboard']);

    // Tipos de habitación: Recepción lee, Admin escribe.
    Route::middleware('role:admin,receptionist')->group(function () {
        Route::get('room-types', [RoomTypeController::class, 'index']);
        Route::get('room-types/{room_type}', [RoomTypeController::class, 'show']);
        Route::get('rooms/available', [RoomController::class, 'available']);
    });
    Route::middleware('role:admin')->group(function () {
        Route::post('room-types', [RoomTypeController::class, 'store']);
        Route::put('room-types/{room_type}', [RoomTypeController::class, 'update']);
        Route::delete('room-types/{room_type}', [RoomTypeController::class, 'destroy']);
    });

    // Operación de recepción: reservas, estadías, huéspedes y cochera.
    Route::middleware('role:admin,receptionist')->group(function () {
        Route::apiResource('reservations', ReservationController::class);
        Route::patch('rooms/{room}/status', [RoomController::class, 'updateStatus']);
        Route::apiResource('rooms', RoomController::class);
        Route::apiResource('clients', ClientController::class);
        Route::post('reservations/{reservation}/check-in', [ReservationController::class, 'checkIn']);
        Route::get('stays', [StayController::class, 'index']);
        Route::get('stays/{stay}', [StayController::class, 'show']);
        Route::post('stays/{stay}/check-out', [StayController::class, 'checkOut']);
        Route::apiResource('parking-spots', ParkingSpotController::class);
        Route::apiResource('parking-assignments', ParkingAssignmentController::class);
    });

    // Inventario: Admin y Almacenero.
    Route::middleware('role:admin,storekeeper')->group(function () {
        Route::apiResource('inventory-items', InventoryItemController::class);
        Route::get('inventory-items/{inventory_item}/movements', [InventoryItemController::class, 'movements']);
        Route::post('inventory-items/{inventory_item}/movements', [InventoryItemController::class, 'storeMovement']);
    });

    // Solo Administrador.
    Route::middleware('role:admin')->group(function () {
        Route::apiResource('staff', StaffController::class)->parameters(['staff' => 'staff']);
        Route::apiResource('users', UserController::class);
        Route::put('users/{user}/roles', [UserController::class, 'updateRoles']);
        Route::get('reports/occupancy', [ReportController::class, 'occupancy']);
        Route::get('reports/income', [ReportController::class, 'income']);
        Route::get('audit-logs', [AuditLogController::class, 'index']);
    });

    // Vista del programador: diagnóstico (salud, rutas, peticiones, errores). Sin secretos.
    Route::middleware('role:developer,admin')->prefix('dev')->group(function () {
        Route::get('overview', [DeveloperController::class, 'overview']);
        Route::get('routes', [DeveloperController::class, 'routes']);
        Route::get('requests', [DeveloperController::class, 'requests']);
        Route::get('errors', [DeveloperController::class, 'errors']);
    });
});
