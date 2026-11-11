<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La ficha del personal se queda solo con la fecha de ingreso: el cargo se deduce del rol
 * (Administrador, Recepcionista, Almacenero) y el turno no se usaba en ninguna pantalla.
 * Al revertir se vuelven a crear las columnas, pero no los valores que tenían.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff', function (Blueprint $table) {
            $table->dropColumn(['position', 'shift']);
        });
    }

    public function down(): void
    {
        Schema::table('staff', function (Blueprint $table) {
            $table->string('position', 60)->default('');
            $table->string('shift', 20)->default('morning');
        });
    }
};
