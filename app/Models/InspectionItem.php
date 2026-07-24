<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy ellenőrzés tétele az eredménnyel (megfelelt / nem megfelelt / na).
 */
class InspectionItem extends Model
{
    protected $fillable = [
        'inspection_id',
        'sort_order',
        'text',
        'result',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(Inspection::class);
    }
}
