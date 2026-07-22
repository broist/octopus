<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Munkaidő-bejegyzés: egy munkatárs egy napon egy projekten hány órát
 * dolgozott. Mindenki saját magának rögzíti (spec §5/6). Bérköltség nincs.
 */
class WorkLog extends Model
{
    protected $fillable = [
        'user_id',
        'project_id',
        'work_date',
        'hours',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'hours' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
