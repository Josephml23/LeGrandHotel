<?php

namespace App\Console\Commands;

use Database\Seeders\LoadTestClientsSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Borra lo que dejan las pruebas de carga k6 en la base local:
 * - las cuentas de carga (k6-…@carga.legrandhotel.test: recepcionistas y clientes), sus fichas y sus reservas;
 * - con --masivos, también los huéspedes de MassiveDataSeeder (los que no tienen cuenta web) y sus reservas.
 * Todo en una transacción: si algo falla, no se borra nada.
 */
class LimpiarPruebasCarga extends Command
{
    protected $signature = 'k6:limpiar {--masivos : Borra también los huéspedes sin cuenta web (MassiveDataSeeder) y sus reservas}';

    protected $description = 'Borra las cuentas, huéspedes y reservas que crean las pruebas de carga k6';

    public function handle(): int
    {
        $resumen = DB::transaction(function () {
            $usuarios = DB::table('users')->where('email', 'like', '%@carga.legrandhotel.test')->pluck('id');

            $clientes = DB::table('clients')->whereIn('user_id', $usuarios)->pluck('id');
            if ($this->option('masivos')) {
                $clientes = $clientes->merge(DB::table('clients')->whereNull('user_id')->pluck('id'));
            }

            $reservas = $this->enLotes($clientes, fn ($lote) => DB::table('reservations')->whereIn('client_id', $lote)->pluck('id'));
            $estadias = $this->enLotes($reservas, fn ($lote) => DB::table('stays')->whereIn('reservation_id', $lote)->pluck('id'));

            // La habitación de una estadía abierta queda libre al borrarla.
            $abiertas = $this->enLotes($estadias, fn ($lote) => DB::table('stays')->whereIn('id', $lote)->whereNull('checked_out_at')->pluck('reservation_id'));
            $habitaciones = $this->enLotes($abiertas, fn ($lote) => DB::table('reservations')->whereIn('id', $lote)->pluck('room_id'));

            $this->borrar('parking_assignments', 'stay_id', $estadias);
            $this->borrar('stays', 'id', $estadias);
            $this->borrar('reservations', 'id', $reservas);
            $this->borrar('clients', 'id', $clientes);
            $this->borrar('personal_access_tokens', 'tokenable_id', $usuarios, fn ($q) => $q->where('tokenable_type', 'App\\Models\\User'));
            $this->borrar('role_user', 'user_id', $usuarios);
            $this->borrar('users', 'id', $usuarios);
            DB::table('rooms')->whereIn('id', $habitaciones)->update(['status' => 'available', 'updated_at' => now()]);

            return [$usuarios->count(), $clientes->count(), $reservas->count(), $estadias->count()];
        });

        @unlink(LoadTestClientsSeeder::tokensPath());

        [$u, $c, $r, $e] = $resumen;
        $this->info("Borrado: {$u} cuentas de carga, {$c} huéspedes, {$r} reservas, {$e} estadías.");

        return self::SUCCESS;
    }

    /**
     * @param  Collection<int, int>  $ids
     * @return Collection<int, int>
     */
    private function enLotes(Collection $ids, callable $consulta): Collection
    {
        return $ids->chunk(1000)->flatMap(fn ($lote) => $consulta($lote->values()->all()))->values();
    }

    /** @param  Collection<int, int>  $ids */
    private function borrar(string $tabla, string $columna, Collection $ids, ?callable $extra = null): void
    {
        foreach ($ids->chunk(1000) as $lote) {
            $q = DB::table($tabla)->whereIn($columna, $lote->values()->all());
            if ($extra) {
                $extra($q);
            }
            $q->delete();
        }
    }
}
