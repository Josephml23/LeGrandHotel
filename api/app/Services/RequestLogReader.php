<?php

namespace App\Services;

/**
 * Lee las últimas líneas del log JSON (storage/logs/laravel.json) sin cargar el archivo entero.
 * Cada petición escribe una línea con request_id, route, status y duration_ms (RequestContext).
 */
class RequestLogReader
{
    /** Bytes leídos desde el final del archivo (~3000 líneas). */
    private const TAIL_BYTES = 1_048_576;

    public function __construct(private readonly ?string $path = null) {}

    /** @return list<array<string, mixed>> líneas decodificadas, de la más reciente a la más antigua */
    public function tail(): array
    {
        $path = $this->path ?? $this->defaultPath();
        if (! is_file($path) || ! is_readable($path)) {
            return [];
        }

        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return [];
        }

        $size = filesize($path) ?: 0;
        $offset = max(0, $size - self::TAIL_BYTES);
        fseek($handle, $offset);
        $chunk = stream_get_contents($handle) ?: '';
        fclose($handle);

        $lines = explode("\n", $chunk);
        if ($offset > 0) {
            array_shift($lines); // primera línea probablemente cortada
        }

        $entries = [];
        foreach (array_reverse($lines) as $line) {
            $decoded = json_decode(trim($line), true);
            if (is_array($decoded)) {
                $entries[] = $decoded;
            }
        }

        return $entries;
    }

    /** @return list<array<string, mixed>> */
    public function requests(): array
    {
        $rows = [];
        foreach ($this->tail() as $entry) {
            if (($entry['message'] ?? null) !== 'request' || ! isset($entry['context']['status'])) {
                continue;
            }
            $rows[] = [
                'time' => $entry['datetime'] ?? null,
                'request_id' => $entry['context']['request_id'] ?? null,
                'user_id' => $entry['context']['user_id'] ?? null,
                'method' => $entry['context']['method'] ?? null,
                'route' => $entry['context']['route'] ?? null,
                'status' => (int) $entry['context']['status'],
                'duration_ms' => (float) ($entry['context']['duration_ms'] ?? 0),
            ];
        }

        return $rows;
    }

    /** @return list<array<string, mixed>> */
    public function errors(): array
    {
        $rows = [];
        foreach ($this->tail() as $entry) {
            if (($entry['level'] ?? 0) < 400) {
                continue;
            }
            $rows[] = [
                'time' => $entry['datetime'] ?? null,
                'level' => $entry['level_name'] ?? 'ERROR',
                'message' => mb_strimwidth((string) ($entry['message'] ?? ''), 0, 300, '…'),
                'incident_id' => $entry['context']['incident_id'] ?? null,
                'request_id' => $entry['context']['request_id'] ?? null,
                'exception' => $entry['context']['exception'] ?? null,
                'file' => $entry['context']['file'] ?? null,
            ];
        }

        return $rows;
    }

    /**
     * Percentil por el método nearest-rank (el mismo que reporta k6 como p(95)).
     *
     * @param  list<float>  $values
     */
    public static function percentile(array $values, float $p): float
    {
        if ($values === []) {
            return 0.0;
        }
        sort($values);
        $rank = (int) ceil($p / 100 * count($values));

        return round($values[max(0, $rank - 1)], 2);
    }

    private function defaultPath(): string
    {
        $stream = config('logging.channels.json.handler_with.stream');

        return is_string($stream) ? $stream : storage_path('logs/laravel.json');
    }
}
