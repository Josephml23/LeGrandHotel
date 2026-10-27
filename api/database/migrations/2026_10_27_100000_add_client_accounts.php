<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cuentas de clientes (solo con Google): la ficha del huésped se enlaza con su usuario,
 * y cada tipo de habitación lista sus servicios para mostrarlos al reservar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->unique()->after('id')->constrained()->nullOnDelete();
        });

        Schema::table('room_types', function (Blueprint $table) {
            $table->json('amenities')->nullable()->after('description');
        });

        // Las bases ya creadas no tienen el rol Cliente: se agrega aquí para no depender de volver a sembrar.
        if (! DB::table('roles')->where('name', 'client')->exists()) {
            DB::table('roles')->insert(['name' => 'client', 'label' => 'Cliente', 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::table('room_types', function (Blueprint $table) {
            $table->dropColumn('amenities');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
