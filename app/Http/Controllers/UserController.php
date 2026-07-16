<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

/**
 * Felhasználók / Munkatársak (16. modul).
 *
 * Az adminisztrátor itt veheti fel és kezelheti a munkatársakat: fiók
 * létrehozása, szerepkör hozzárendelése, adatok módosítása, ki- és
 * bekapcsolás (aktiválás). A deaktivált fiókok nem tudnak belépni
 * (lásd FortifyServiceProvider::authenticateUsing).
 */
class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();

        $users = User::query()
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%")
                        ->orWhere('job_title', 'ilike', "%{$search}%");
                });
            })
            ->with('roles:id,name')
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'phone' => $u->phone,
                'job_title' => $u->job_title,
                'initials' => $u->initials(),
                'is_active' => (bool) $u->is_active,
                'is_external' => (bool) $u->is_external,
                'role' => $u->roles->first()?->name,
                'two_factor_enabled' => $u->hasTwoFactorEnabled(),
                'is_self' => $u->id === $request->user()->id,
            ])
            ->values();

        return Inertia::render('Users/Index', [
            'users' => $users,
            'roles' => Role::where('guard_name', 'web')->orderBy('name')->pluck('name')->values(),
            'filters' => ['search' => $search],
        ]);
    }

    public function store(UserRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null,
            'job_title' => $data['job_title'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'is_external' => $data['is_external'] ?? false,
            'email_verified_at' => now(),
        ]);

        if (! empty($data['role'])) {
            $user->syncRoles([$data['role']]);
        }

        return back()->with('success', "{$user->name} munkatárs felvéve.");
    }

    public function update(UserRequest $request, User $user): RedirectResponse
    {
        $data = $request->validated();

        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'job_title' => $data['job_title'] ?? null,
            'is_active' => $data['is_active'] ?? $user->is_active,
            'is_external' => $data['is_external'] ?? $user->is_external,
        ]);

        if (! empty($data['password'])) {
            $user->update(['password' => Hash::make($data['password'])]);
        }

        // A szerepkört csak akkor bántjuk, ha szerepel a kérésben.
        if ($request->has('role')) {
            $user->syncRoles(array_filter([$data['role'] ?? null]));
        }

        return back()->with('success', "{$user->name} adatai módosítva.");
    }

    /**
     * Aktiválás / deaktiválás gyors kapcsolóval (a lista soraiból).
     */
    public function toggleActive(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'A saját fiókját nem kapcsolhatja ki.');
        }

        $user->update(['is_active' => ! $user->is_active]);

        return back()->with(
            'success',
            $user->is_active
                ? "{$user->name} fiókja aktiválva."
                : "{$user->name} fiókja deaktiválva – mostantól nem tud belépni.",
        );
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'A saját fiókját nem törölheti.');
        }

        $name = $user->name;
        $user->delete();

        return back()->with('success', "{$name} munkatárs törölve.");
    }
}
