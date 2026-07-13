<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'progress' => ['required', 'integer', 'min:0', 'max:100'],
            'note' => ['nullable', 'string', 'max:1000'],
            'depends_on' => ['nullable', 'array'],
            'depends_on.*' => ['integer', 'exists:project_phases,id'],
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
        ];
    }
}
