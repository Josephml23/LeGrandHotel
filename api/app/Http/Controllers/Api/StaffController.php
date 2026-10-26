<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\StaffRequest;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Personal del hotel: cada ficha de personal tiene su cuenta de usuario con rol de trabajo.
 */
class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $staff = Staff::query()
            ->with('user:id,name,email', 'user.roles:id,name')
            ->when($request->query('shift'), fn ($q, $v) => $q->where('shift', $v))
            ->when($request->query('search'), fn ($q, $s) => $q->whereHas('user', fn ($u) => $u
                ->where('name', 'like', $this->like($s))
                ->orWhere('email', 'like', $this->like($s))))
            ->latest('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($staff);
    }

    public function store(StaffRequest $request): JsonResponse
    {
        $data = $request->validated();

        $staff = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'email_verified_at' => now(),
            ]);
            $user->assignRole($data['role']);

            return Staff::create([
                'user_id' => $user->id,
                'position' => $data['position'],
                'shift' => $data['shift'],
                'hired_at' => $data['hired_at'],
            ]);
        });

        return ApiResponse::created($staff->load('user.roles'));
    }

    public function show(Staff $staff): JsonResponse
    {
        return ApiResponse::success($staff->load('user.roles'));
    }

    public function update(StaffRequest $request, Staff $staff): JsonResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $staff) {
            $staff->update(array_intersect_key($data, array_flip(['position', 'shift', 'hired_at'])));
            $staff->user->update(array_intersect_key($data, array_flip(['name', 'email', 'password'])));

            if (isset($data['role'])) {
                $workRoles = Role::whereIn('name', [Role::ADMIN, Role::RECEPTIONIST, Role::STOREKEEPER])->pluck('id');
                $staff->user->roles()->detach($workRoles);
                $staff->user->assignRole($data['role']);
            }
        });

        return ApiResponse::success($staff->fresh('user.roles'));
    }

    public function destroy(Request $request, Staff $staff): JsonResponse
    {
        if ($staff->user_id === $request->user()->id) {
            throw ApiException::conflict('CANNOT_DELETE_SELF', 'No puedes eliminar tu propia ficha de personal.');
        }

        // Al eliminar la cuenta se elimina la ficha (cascade) y se revocan sus tokens.
        DB::transaction(function () use ($staff) {
            $staff->user->tokens()->delete();
            $staff->delete();
            $staff->user->delete();
        });

        return ApiResponse::noContent();
    }
}
