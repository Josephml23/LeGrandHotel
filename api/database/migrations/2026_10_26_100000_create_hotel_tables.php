<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tablas del dominio de LeGrandHotel (ver docs/diagramas/legrandhotel.dbml).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('label');
            $table->timestamps();
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->primary(['user_id', 'role_id']);
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('document_type', 20);
            $table->string('document_number', 20)->unique();
            $table->string('full_name');
            $table->string('phone', 30)->nullable();
            $table->string('nationality', 60)->nullable();
            $table->timestamps();
            $table->index('full_name');
        });

        Schema::create('staff', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('position', 60);
            $table->string('shift', 20);
            $table->date('hired_at');
            $table->timestamps();
        });

        Schema::create('room_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('capacity');
            $table->decimal('price_per_night', 10, 2);
            $table->timestamps();
        });

        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_type_id')->constrained()->restrictOnDelete();
            $table->string('number', 10)->unique();
            $table->unsignedSmallInteger('floor');
            $table->string('status', 20)->default('available');
            $table->timestamps();
            $table->index('status');
        });

        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->date('check_in');
            $table->date('check_out');
            $table->unsignedSmallInteger('guests')->default(1);
            $table->string('status', 20)->default('confirmed');
            $table->decimal('total', 10, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['check_in', 'check_out']);
            $table->index('client_id');
            $table->index(['room_id', 'status']);
        });

        Schema::create('stays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->unique()->constrained()->cascadeOnDelete();
            $table->timestamp('checked_in_at');
            $table->timestamp('checked_out_at')->nullable();
            $table->timestamps();
        });

        Schema::create('parking_spots', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();
            $table->string('status', 20)->default('free');
            $table->timestamps();
            $table->index('status');
        });

        Schema::create('parking_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parking_spot_id')->constrained()->restrictOnDelete();
            $table->foreignId('stay_id')->nullable()->constrained()->nullOnDelete();
            $table->string('plate', 15);
            $table->timestamp('entered_at');
            $table->timestamp('left_at')->nullable();
            $table->timestamps();
            $table->index('plate');
        });

        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('unit', 20);
            $table->integer('stock')->default(0);
            $table->integer('min_stock')->default(0);
            $table->timestamps();
            $table->index('name');
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 10);
            $table->integer('quantity');
            $table->string('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 20);
            $table->string('entity', 60);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('changes')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['entity', 'entity_id']);
        });
    }

    public function down(): void
    {
        foreach ([
            'audit_logs', 'inventory_movements', 'inventory_items', 'parking_assignments',
            'parking_spots', 'stays', 'reservations', 'rooms', 'room_types', 'staff',
            'clients', 'role_user', 'roles',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
