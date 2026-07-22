<?php

namespace App\Http\Requests;

use App\Http\Requests\DocumentRequest;
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
            // Felelős és határidő immár kötelező (megrendelői kérés).
            'due_on' => ['required', 'date'],
            'assignees' => ['required', 'array', 'min:1'],
            'assignees.*' => ['integer', 'exists:users,id'],
            // Csatolmányok (fájl/kép), szerkesztéskor törölhető meglévők.
            'attachments' => ['nullable', 'array', 'max:20'],
            'attachments.*' => ['file', 'max:'.DocumentRequest::MAX_KB, 'extensions:'.DocumentRequest::EXTENSIONS],
            'remove_attachments' => ['nullable', 'array'],
            'remove_attachments.*' => ['integer'],
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
            'due_on.required' => 'A határidő megadása kötelező.',
            'due_on.date' => 'Érvényes határidőt adjon meg.',
            'assignees.required' => 'Legalább egy felelőst ki kell jelölni.',
            'assignees.min' => 'Legalább egy felelőst ki kell jelölni.',
            'project_id.exists' => 'A kiválasztott projekt nem található.',
            'assignees.*.exists' => 'A kiválasztott felelős nem található.',
            'attachments.*.max' => 'Valamelyik csatolmány túl nagy (legfeljebb 120 MB).',
            'attachments.*.extensions' => 'Valamelyik csatolmány típusa nem engedélyezett.',
        ];
    }
}
