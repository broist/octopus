<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Munkatárs (felhasználó) létrehozása és szerkesztése.
 *
 * A jogosultság-ellenőrzést a route middleware (can:users.create / users.edit)
 * végzi. Létrehozáskor a jelszó kötelező, szerkesztéskor csak akkor kell, ha
 * meg is adják (üresen hagyva a régi marad).
 */
class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userId = $this->route('user')?->id;
        $isCreate = $userId === null;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required', 'string', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'password' => [
                $isCreate ? 'required' : 'nullable',
                'string', 'confirmed', Password::default(),
            ],
            'phone' => ['nullable', 'string', 'max:50'],
            'job_title' => ['nullable', 'string', 'max:120'],
            'role' => ['nullable', 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'is_active' => ['boolean'],
            'is_external' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'A munkatárs neve kötelező.',
            'email.required' => 'Az e-mail cím kötelező.',
            'email.email' => 'Érvényes e-mail címet adjon meg.',
            'email.unique' => 'Ezzel az e-mail címmel már létezik felhasználó.',
            'password.required' => 'A jelszó megadása kötelező.',
            'password.confirmed' => 'A két jelszó nem egyezik.',
            'role.exists' => 'A kiválasztott szerepkör nem található.',
        ];
    }
}
