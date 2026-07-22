<?php

namespace App\Http\Requests;

use App\Models\PhaseResource;
use App\Models\ProjectPhase;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectPhaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route middleware handles the permission check
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'starts_on' => ['nullable', 'date'],
            'due_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'work_days' => ['nullable', 'integer', 'min:1', 'max:999'],
            'progress' => ['required', 'integer', 'min:0', 'max:100'],
            'note' => ['nullable', 'string', 'max:1000'],

            // Függőségek: elődhöz kötött típussal (KK/BB/BK/KB) és eltolással.
            'depends_on' => ['nullable', 'array'],
            'depends_on.*.id' => ['required', 'integer', 'exists:project_phases,id'],
            'depends_on.*.type' => ['required', Rule::in(array_keys(ProjectPhase::DEP_TYPES))],
            'depends_on.*.lag' => ['required', 'integer', 'between:-365,365'],

            // Erőforrások.
            'resources' => ['nullable', 'array'],
            'resources.*.kind' => ['required', Rule::in(array_keys(PhaseResource::KINDS))],
            'resources.*.name' => ['required', 'string', 'max:150'],
            'resources.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'resources.*.work_days' => ['required', 'integer', 'min:1', 'max:999'],
            'resources.*.note' => ['nullable', 'string', 'max:250'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'A fázis neve kötelező.',
            'name.max' => 'A fázis neve legfeljebb 120 karakter lehet.',
            'due_on.after_or_equal' => 'A határidő nem lehet korábbi a kezdésnél.',
            'progress.required' => 'A készültség megadása kötelező.',
            'progress.min' => 'A készültség 0 és 100 között lehet.',
            'progress.max' => 'A készültség 0 és 100 között lehet.',
            'resources.*.name.required' => 'Az erőforrás megnevezése kötelező.',
        ];
    }
}
