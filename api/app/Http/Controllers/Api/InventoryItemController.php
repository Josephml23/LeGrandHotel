<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\InventoryItemRequest;
use App\Http\Requests\InventoryMovementRequest;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $items = InventoryItem::query()
            ->when($request->query('search'), fn ($q, $s) => $q->where('name', 'like', $this->like($s)))
            ->when($request->boolean('low_stock'), fn ($q) => $q->whereColumn('stock', '<=', 'min_stock'))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($items);
    }

    public function store(InventoryItemRequest $request): JsonResponse
    {
        return ApiResponse::created(InventoryItem::create($request->validated()));
    }

    public function show(InventoryItem $inventoryItem): JsonResponse
    {
        return ApiResponse::success($inventoryItem);
    }

    public function update(InventoryItemRequest $request, InventoryItem $inventoryItem): JsonResponse
    {
        $inventoryItem->update($request->validated());

        return ApiResponse::success($inventoryItem);
    }

    public function destroy(InventoryItem $inventoryItem): JsonResponse
    {
        $inventoryItem->delete();

        return ApiResponse::noContent();
    }

    public function movements(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $movements = $inventoryItem->movements()
            ->with('user:id,name')
            ->latest('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($movements);
    }

    /** POST /inventory-items/{id}/movements: entrada o salida de stock. */
    public function storeMovement(InventoryMovementRequest $request, InventoryItem $inventoryItem): JsonResponse
    {
        $data = $request->validated();

        $movement = DB::transaction(function () use ($data, $inventoryItem, $request) {
            $item = InventoryItem::lockForUpdate()->findOrFail($inventoryItem->id);

            if ($data['type'] === InventoryMovement::OUT && $data['quantity'] > $item->stock) {
                throw ApiException::conflict('INSUFFICIENT_STOCK', __('Stock insuficiente: quedan :stock :unit.', ['stock' => $item->stock, 'unit' => $item->unit]), [
                    'available' => $item->stock,
                ]);
            }

            $delta = $data['type'] === InventoryMovement::IN ? $data['quantity'] : -$data['quantity'];
            $item->update(['stock' => $item->stock + $delta]);

            return $item->movements()->create([...$data, 'user_id' => $request->user()->id]);
        });

        return ApiResponse::created([
            'movement' => $movement,
            'item' => $inventoryItem->fresh(),
        ]);
    }
}
