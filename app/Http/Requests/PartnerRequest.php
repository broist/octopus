<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Partner (ügyfél / beszállító / alvállalkozó) felvétele és szerkesztése.
 * A jogosultság-ellenőrzést a route middleware (can:crm.create / crm.edit) végzi.
 */
class PartnerRequest extends FormRequest
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
        return [
            'name' => ['required', 'string', 'max:200'],
            'is_company' => ['boolean'],
            'is_client' => ['boolean'],
            'is_supplier' => ['boolean'],
            'is_subcontractor' => ['boolean'],
            'contact_name' => ['nullable', 'string', 'max:200'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'tax_id' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'A partner neve kötelező.',
            'name.max' => 'A név legfeljebb 200 karakter lehet.',
            'email.email' => 'Érvényes e-mail címet adjon meg.',
        ];
    }
}
