<?php

namespace App\Http\Requests;

use App\Models\CalendarEvent;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CalendarEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // finomhangolt ellenőrzés a controllerben
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'type' => ['required', Rule::in(array_keys(CalendarEvent::TYPES))],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => [
                'nullable', 'date_format:H:i',
                function ($attribute, $value, $fail) {
                    if ($value && $this->input('start_time')
                        && $this->input('starts_on') === $this->input('ends_on')
                        && $value <= $this->input('start_time')) {
                        $fail('A befejezés időpontja nem lehet korábbi a kezdésnél.');
                    }
                },
            ],
            'location' => ['nullable', 'string', 'max:200'],
            'note' => ['nullable', 'string', 'max:2000'],
            'assignees' => ['nullable', 'array'],
            'assignees.*' => ['integer', 'exists:users,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Az esemény címe kötelező.',
            'type.required' => 'A típus megadása kötelező.',
            'type.in' => 'Érvénytelen esemény-típus.',
            'starts_on.required' => 'A kezdő dátum kötelező.',
            'ends_on.required' => 'A záró dátum kötelező.',
            'ends_on.after_or_equal' => 'A záró dátum nem lehet korábbi a kezdésnél.',
            'start_time.date_format' => 'Az időpont formátuma ÓÓ:PP legyen.',
            'end_time.date_format' => 'Az időpont formátuma ÓÓ:PP legyen.',
            'project_id.exists' => 'A kiválasztott projekt nem található.',
        ];
    }
}
