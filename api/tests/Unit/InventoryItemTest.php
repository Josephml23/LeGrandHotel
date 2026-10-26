<?php

use App\Models\InventoryItem;

it('alerta cuando el stock llega o baja del mínimo', function (int $stock, int $min, bool $alert) {
    $item = new InventoryItem(['name' => 'Toallas', 'unit' => 'unidad', 'stock' => $stock, 'min_stock' => $min]);

    expect($item->isBelowMinimum())->toBe($alert)
        ->and($item->low_stock)->toBe($alert);
})->with([
    'sobre el mínimo' => [50, 10, false],
    'igual al mínimo' => [10, 10, true],
    'bajo el mínimo' => [3, 10, true],
]);
