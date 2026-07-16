<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route middleware handles the permission check
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:5000'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'status' => ['required', Rule::in(array_keys(Task::STATUSES))],
            'priority' => ['required', Rule::in(array_keys(Task::PRIORITIES))],
            'due_on' => ['nullable', 'date'],
            'assignees' => ['nullable', 'array'],
            'assignees.*' => ['integer', 'exists:users,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'A feladat címe kötelező.',
            'title.max' => 'A cím legfeljebb 200 karakter lehet.',
            'status.required' => 'A státusz megadása kötelező.',
            'status.in' => 'Érvénytelen státusz.',
            'priority.required' => 'A prioritás megadása kötelező.',
            'priority.in' => 'Érvénytelen prioritás.',
            'project_id.exists' => 'A kiválasztott projekt nem található.',
            'assignees.*.exists' => 'A kiválasztott felelős nem található.',
        ];
    }
}
