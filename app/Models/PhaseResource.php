<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Fázishoz rendelt erőforrás (kézi vagy gépi), pl. „3 fő kézi erő 2 napra".
 */
class PhaseResource extends Model
{
    public const KINDS = [
        'kezi' => 'Kézi erő',
        'gepi' => 'Gépi erő',
    ];

    protected $fillable = [
        'project_phase_id',
        'kind',
        'name',
        'quantity',
        'work_days',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'work_days' => 'integer',
        ];
    }

    public function phase(): BelongsTo
    {
        return $this->belongsTo(ProjectPhase::class, 'project_phase_id');
    }
}
