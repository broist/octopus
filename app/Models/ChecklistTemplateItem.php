<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy ellenőrző-sablon tétele (ellenőrzési pont).
 */
class ChecklistTemplateItem extends Model
{
    protected $fillable = [
        'checklist_template_id',
        'sort_order',
        'text',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'checklist_template_id');
    }
}
