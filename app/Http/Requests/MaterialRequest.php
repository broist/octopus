<?php

namespace App\Http\Requests;

use App\Support\Materials;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Anyagtörzs (spec §8) felvétele és szerkesztése. A jogosultságot a route
 * middleware (can:materials.create / materials.edit) ellenőrzi.
 */
class MaterialRequest extends FormRequest
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
            'category' => ['nullable', Rule::in(array_keys(Materials::CATEGORIES))],
            'unit' => ['required', Rule::in(array_keys(Materials::UNITS))],
            'sku' => ['nullable', 'string', 'max:60'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Az anyag neve kötelező.',
            'unit.required' => 'Válasszon mértékegységet.',
        ];
    }
}
