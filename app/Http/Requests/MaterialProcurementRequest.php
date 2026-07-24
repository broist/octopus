<?php

namespace App\Http\Requests;

use App\Support\Materials;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Projekthez kötött anyagbeszerzés (spec §8) felvétele és szerkesztése.
 * A jogosultságot a route middleware (can:materials.create / materials.edit)
 * ellenőrzi.
 */
class MaterialProcurementRequest extends FormRequest
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
            'project_id' => ['required', 'exists:projects,id'],
            'material_id' => ['required', 'exists:materials,id'],
            'supplier_id' => ['nullable', 'exists:partners,id'],
            'status' => ['required', Rule::in(array_keys(Materials::STATUSES))],
            'quantity' => ['required', 'numeric', 'min:0.001', 'max:99999999'],
            'unit_price' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'ordered_on' => ['nullable', 'date'],
            'expected_on' => ['nullable', 'date'],
            'received_on' => ['nullable', 'date'],
            'received_quantity' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'project_id.required' => 'Válasszon projektet.',
            'material_id.required' => 'Válasszon anyagot.',
            'status.required' => 'Válasszon státuszt.',
            'quantity.required' => 'Adja meg a mennyiséget.',
            'quantity.min' => 'A mennyiség nagyobb legyen nullánál.',
        ];
    }
}
