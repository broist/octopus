<?php

namespace App\Http\Requests;

use App\Support\Qa;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Hiba / hiányosság (spec §12) felvétele és szerkesztése. A jogosultságot a
 * route middleware (can:qa.create / qa.edit) ellenőrzi. A fotók (photos[])
 * multipart FormData-ként érkeznek.
 */
class DefectRequest extends FormRequest
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
            'inspection_id' => ['nullable', 'exists:inspections,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'severity' => ['required', Rule::in(array_keys(Qa::SEVERITIES))],
            'status' => ['required', Rule::in(array_keys(Qa::DEFECT_STATUSES))],
            'responsible_user_id' => ['nullable', 'exists:users,id'],
            'due_on' => ['nullable', 'date'],

            'photos' => ['nullable', 'array'],
            'photos.*' => ['file', 'max:25600'],
            'remove_photos' => ['nullable', 'array'],
            'remove_photos.*' => ['integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'project_id.required' => 'Válasszon projektet.',
            'title.required' => 'Adja meg a hiba megnevezését.',
            'photos.*.max' => 'Egy fotó legfeljebb 25 MB lehet.',
        ];
    }
}
