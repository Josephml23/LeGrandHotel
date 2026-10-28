<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\UserRequest;
use App\Http\Requests\UserRolesRequest;
use App\Models\Role;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->with('roles:id,name')
            ->when($request->query('role'), fn ($q, $r) => $q->whereHas('roles', fn ($w) => $w->where('name', $r)))
            ->when($request->query('search'), fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('name', 'like', $this->like($s))
                ->orWhere('email', 'like', $this->like($s))))
            ->latest('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($users);
    }

    public function store(UserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'email_verified_at' => now(),
            ]);
            $user->roles()->sync(Role::whereIn('name', $data['roles'])->pluck('id'));

            return $user;
        });

        return ApiResponse::created($user->load('roles'));
    }

    public function show(User $user): JsonResponse
    {
        return ApiResponse::success($user->load('roles', 'staff'));
    }

    public function update(UserRequest $request, User $user): JsonResponse
    {
        $user->update($request->validated());

        return ApiResponse::success($user->load('roles'));
    }

    public function updateRoles(UserRolesRequest $request, User $user): JsonResponse
    {
        $roles = $request->validated('roles');

        // Las cuentas de cliente se crean con Google y no pasan a ser personal.
        if ($user->hasRole(Role::CLIENT)) {
            throw ApiException::conflict('CLIENT_ROLES_LOCKED', 'Una cuenta de cliente no puede recibir roles del personal.');
        }

        if ($user->is($request->user()) && ! in_array(Role::ADMIN, $roles, true)) {
            throw ApiException::conflict('CANNOT_REMOVE_OWN_ADMIN', 'No puedes quitarte tu propio rol de administrador.');
        }

        Role::guardDeveloper($user, $roles);

        $user->roles()->sync(Role::whereIn('name', $roles)->pluck('id'));
        $user->tokens()->delete();

        return ApiResponse::success($user->load('roles'));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->is($request->user())) {
            throw ApiException::conflict('CANNOT_DELETE_SELF', 'No puedes eliminar tu propia cuenta.');
        }
        if ($user->hasRole(Role::DEVELOPER)) {
            throw ApiException::conflict('DEVELOPER_LOCKED', 'La cuenta del Programador no se puede eliminar: es la única cuenta de soporte técnico.');
        }

        $user->tokens()->delete();
        $user->delete();

        return ApiResponse::noContent();
    }
}
