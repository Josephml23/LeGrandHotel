<?php

use Illuminate\Support\Facades\Schedule;

// Limpieza de tokens de Sanctum vencidos hace más de 24 h.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
