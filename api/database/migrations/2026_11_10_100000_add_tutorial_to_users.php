<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tutorial de bienvenida: se ofrece una sola vez por cuenta (en cualquier equipo).
 * Se guarda cuándo lo terminó u omitió; desde Configuración se puede repetir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('tutorial_seen_at')->nullable();
            $table->string('tutorial_outcome', 10)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['tutorial_seen_at', 'tutorial_outcome']);
        });
    }
};
