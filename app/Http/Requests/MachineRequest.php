<?php

namespace App\Http\Requests;

use App\Support\Machines;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Gép / eszköz törzsadatainak felvétele és szerkesztése (spec §7). A jogosultságot
 * a route middleware (can:machines.create / machines.edit) ellenőrzi.
 */
class MachineRequest extends FormRequest
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
            'kind' => ['nullable', Rule::in(array_keys(Machines::KINDS))],
            'identifier' => ['nullable', 'string', 'max:120'],
            'manufacture_year' => ['nullable', 'integer', 'min:1950', 'max:'.(date('Y') + 1)],
            'purchased_on' => ['nullable', 'date'],
            'ownership' => ['required', Rule::in(array_keys(Machines::OWNERSHIP))],
            'rental_source' => ['nullable', 'string', 'max:200'],
            'status' => ['required', Rule::in(array_keys(Machines::STATUSES))],
            'location' => ['nullable', 'string', 'max:200'],
            'responsible_user_id' => ['nullable', 'exists:users,id'],
            'next_service_on' => ['nullable', 'date'],
            'inspection_valid_until' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'A gép / eszköz neve kötelező.',
            'name.max' => 'A név legfeljebb 200 karakter lehet.',
            'ownership.required' => 'Válassza ki a tulajdonviszonyt.',
            'status.required' => 'Válassza ki a státuszt.',
            'manufacture_year.integer' => 'A gyártási év egész szám legyen.',
            'manufacture_year.min' => 'Adjon meg érvényes gyártási évet.',
            'manufacture_year.max' => 'A gyártási év nem lehet a jövőben.',
        ];
    }
}
