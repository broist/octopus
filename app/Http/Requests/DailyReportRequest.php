<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Napi jelentés / Munkanapló (spec §11) létrehozása és szerkesztése. A
 * jogosultságot a route middleware (can:daily-reports.create / .edit) ellenőrzi.
 * A fotók feltöltése (photos[]) és a listás létszám-adatok (workers[], crews[])
 * multipart FormData-ként érkeznek.
 */
class DailyReportRequest extends FormRequest
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
            'report_date' => ['required', 'date'],
            'work_done' => ['required', 'string', 'max:5000'],
            'obstacles' => ['nullable', 'string', 'max:5000'],
            'own_headcount' => ['nullable', 'integer', 'min:0', 'max:999'],
            'material_movement' => ['nullable', 'string', 'max:5000'],
            'machine_movement' => ['nullable', 'string', 'max:5000'],

            'workers' => ['nullable', 'array'],
            'workers.*' => ['integer', 'exists:users,id'],

            'crews' => ['nullable', 'array'],
            'crews.*.subcontractor_id' => ['required', 'exists:partners,id'],
            'crews.*.headcount' => ['nullable', 'integer', 'min:0', 'max:999'],
            'crews.*.note' => ['nullable', 'string', 'max:255'],

            'photos' => ['nullable', 'array'],
            'photos.*' => ['file', 'max:25600'], // 25 MB / fotó

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
            'report_date.required' => 'Adja meg a jelentés dátumát.',
            'work_done.required' => 'Írja le, mit végeztek aznap.',
            'photos.*.max' => 'Egy fotó legfeljebb 25 MB lehet.',
        ];
    }
}
