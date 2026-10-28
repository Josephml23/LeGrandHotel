<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El cliente que entra con Google puede dejar su DNI para después (perfil o al reservar).
 * El índice único se mantiene: MySQL y SQLite permiten varias filas con NULL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('document_type', 20)->nullable()->change();
            $table->string('document_number', 20)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('document_type', 20)->nullable(false)->change();
            $table->string('document_number', 20)->nullable(false)->change();
        });
    }
};
