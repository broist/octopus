<?php

namespace App\Http\Requests;

use App\Support\Subcontractors;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Alvállalkozó törzsadatainak felvétele és szerkesztése. A háttérben ugyanaz a
 * partners tábla, mint a CRM-nél — itt az is_subcontractor mindig igaz, és a
 * szakma/kapacitás mezők is kitölthetők. A jogosultságot a route middleware
 * (can:subcontractors.create / subcontractors.edit) ellenőrzi.
 */
class SubcontractorRequest extends FormRequest
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
            'trade' => ['nullable', 'string', Rule::in(array_keys(Subcontractors::TRADES))],
            'crew_size' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'availability_note' => ['nullable', 'string', 'max:2000'],
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
            'name.required' => 'Az alvállalkozó neve kötelező.',
            'name.max' => 'A név legfeljebb 200 karakter lehet.',
            'email.email' => 'Érvényes e-mail címet adjon meg.',
            'crew_size.integer' => 'A létszám egész szám legyen.',
        ];
    }
}
