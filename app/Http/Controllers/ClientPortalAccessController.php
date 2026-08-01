<?php

namespace App\Http\Controllers;

use App\Models\Partner;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

/**
 * Ügyfélportál-hozzáférés kezelése a partner adatlapjáról (CRM).
 *
 * A megrendelő nem regisztrál magának: az adminisztrátor hoz létre neki fiókot,
 * ami külső (`is_external`) és a partnerhez van kötve. A „Megrendelő" szerep
 * szándékosan jogosultság nélküli — a portál tartalmát nem jogosultságok, hanem
 * a partner-kötés és a megosztás-kapcsolók szabják meg.
 */
class ClientPortalAccessController extends Controller
{
    public function store(Request $request, Partner $partner): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:10', 'max:190'],
        ], $this->messages());

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'job_title' => 'Megrendelő',
            'is_active' => true,
            'is_external' => true,
            'partner_id' => $partner->id,
            'email_verified_at' => now(),
        ]);

        if (Role::where('name', 'Megrendelő')->where('guard_name', 'web')->exists()) {
            $user->syncRoles(['Megrendelő']);
        }

        return back()->with(
            'success',
            "{$user->name} portál-hozzáférést kapott. A belépési adatokat Ön adja át neki.",
        );
    }

    public function update(Request $request, Partner $partner, User $user): RedirectResponse
    {
        $this->assertBelongsTo($user, $partner);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:10', 'max:190'],
            'is_active' => ['boolean'],
        ], $this->messages());

        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
            'is_active' => $data['is_active'] ?? $user->is_active,
        ]);

        if (! empty($data['password'])) {
            $user->update(['password' => Hash::make($data['password'])]);
        }

        return back()->with('success', "{$user->name} portál-hozzáférése frissítve.");
    }

    public function destroy(Partner $partner, User $user): RedirectResponse
    {
        $this->assertBelongsTo($user, $partner);

        $name = $user->name;
        $user->delete();

        return back()->with('success', "{$name} portál-hozzáférése visszavonva.");
    }

    /* ------------------------------------------------------------------ */

    /**
     * Csak ennek a partnernek a külső fiókjai módosíthatók innen — belső
     * munkatárs fiókja soha.
     */
    private function assertBelongsTo(User $user, Partner $partner): void
    {
        abort_unless($user->is_external && $user->partner_id === $partner->id, 404);
    }

    /**
     * @return array<string, string>
     */
    private function messages(): array
    {
        return [
            'name.required' => 'A kapcsolattartó neve kötelező.',
            'email.required' => 'Az e-mail cím kötelező — ezzel fog belépni.',
            'email.unique' => 'Ezzel az e-mail címmel már létezik fiók.',
            'password.required' => 'Adjon meg egy kezdeti jelszót.',
            'password.min' => 'A jelszó legalább 10 karakter legyen.',
        ];
    }
}
