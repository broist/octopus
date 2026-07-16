<?php

namespace App\Http\Requests;

use App\Models\Document;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DocumentRequest extends FormRequest
{
    /** Engedélyezett kiterjesztések (építőipari formátumokkal: dwg, dxf, ifc). */
    public const EXTENSIONS = 'jpg,jpeg,png,gif,webp,heic,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,dwg,dxf,skp,ifc';

    /** Max fájlméret KB-ban (~120 MB; a PHP/nginx limit 128/140 MB). */
    public const MAX_KB = 122880;

    public function authorize(): bool
    {
        return true; // route middleware handles the permission check
    }

    public function rules(): array
    {
        $rules = [
            'title' => ['required', 'string', 'max:200'],
            'category' => ['required', Rule::in(array_keys(Document::CATEGORIES))],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'partner_id' => ['nullable', 'integer', 'exists:partners,id'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];

        // Új dokumentumnál kötelező a fájl; meta-szerkesztésnél nincs fájl.
        if ($this->isMethod('post')) {
            $rules['file'] = [
                'required', 'file',
                'max:'.self::MAX_KB,
                'extensions:'.self::EXTENSIONS,
            ];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'title.required' => 'A dokumentum megnevezése kötelező.',
            'category.required' => 'A kategória kiválasztása kötelező.',
            'category.in' => 'Érvénytelen kategória.',
            'file.required' => 'Válasszon ki egy fájlt a feltöltéshez.',
            'file.max' => 'A fájl túl nagy (legfeljebb 120 MB lehet).',
            'file.extensions' => 'Ez a fájltípus nem engedélyezett.',
        ];
    }
}
