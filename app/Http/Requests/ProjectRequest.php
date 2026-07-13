<?php

namespace App\Http\Requests;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route middleware handles the permission check
    }

    public function rules(): array
    {
        /** @var Project|null $project route-bound model on update */
        $project = $this->route('project');

        return [
            'name' => ['required', 'string', 'max:200'],
            'code' => [
                'required', 'string', 'max:30',
                Rule::unique('projects', 'code')->ignore($project?->id)->withoutTrashed(),
            ],
            'status' => ['required', Rule::in(array_keys(Project::STATUSES))],
            'construction_type' => ['nullable', Rule::in(array_keys(Project::CONSTRUCTION_TYPES))],
            'client_id' => ['nullable', 'integer', 'exists:partners,id'],
            'project_manager_id' => ['nullable', 'integer', 'exists:users,id'],
            'parent_id' => [
                'nullable', 'integer', 'exists:projects,id',
                function ($attribute, $value, $fail) use ($project) {
                    if ($project && (int) $value === $project->id) {
                        $fail('A projekt nem lehet saját maga alprojektje.');
                        return;
                    }
                    // Csak egy szintű beágyazás: a szülő nem lehet maga is alprojekt.
                    $parent = Project::find($value);
                    if ($parent && $parent->parent_id !== null) {
                        $fail('Alprojekt alá nem hozható létre további alprojekt.');
                    }
                },
            ],
            'location_city' => ['nullable', 'string', 'max:120'],
            'location_address' => ['nullable', 'string', 'max:255'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'A projekt neve kötelező.',
            'name.max' => 'A projekt neve legfeljebb 200 karakter lehet.',
            'code.required' => 'A projekt azonosítója kötelező.',
            'code.unique' => 'Ez az azonosító már foglalt.',
            'code.max' => 'Az azonosító legfeljebb 30 karakter lehet.',
            'status.required' => 'A státusz megadása kötelező.',
            'status.in' => 'Érvénytelen státusz.',
            'construction_type.in' => 'Érvénytelen kivitelezés-típus.',
            'client_id.exists' => 'A kiválasztott megrendelő nem található.',
            'project_manager_id.exists' => 'A kiválasztott projektvezető nem található.',
            'parent_id.exists' => 'A kiválasztott főprojekt nem található.',
            'ends_on.after_or_equal' => 'A befejezés nem lehet korábbi a kezdésnél.',
            'description.max' => 'A leírás legfeljebb 5000 karakter lehet.',
        ];
    }
}
