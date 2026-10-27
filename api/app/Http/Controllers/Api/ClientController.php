<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ClientRequest;
use App\Models\Client;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = $request->query('search');

        $clients = Client::query()
            ->withCount('reservations')
            ->when($search, fn ($q) => $q->where(fn ($w) => $w
                ->where('document_number', 'like', addcslashes($search, '%_\\').'%')
                ->orWhere('full_name', 'like', $this->like($search))))
            ->latest('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($clients);
    }

    public function store(ClientRequest $request): JsonResponse
    {
        return ApiResponse::created(Client::create($request->validated()));
    }

    public function show(Client $client): JsonResponse
    {
        return ApiResponse::success($client->loadCount('reservations'));
    }

    public function update(ClientRequest $request, Client $client): JsonResponse
    {
        $client->update($request->validated());

        return ApiResponse::success($client);
    }

    public function destroy(Client $client): JsonResponse
    {
        if ($client->reservations()->exists()) {
            throw ApiException::conflict('CLIENT_HAS_RESERVATIONS', 'No se puede eliminar: el cliente tiene reservas registradas.');
        }

        $client->delete();

        return ApiResponse::noContent();
    }
}
