<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Alvállalkozói teljesítmény-értékelés (1–5 csillag + megjegyzés),
 * opcionálisan egy projekthez kötve.
 */
class SubcontractorRating extends Model
{
    protected $fillable = [
        'partner_id',
        'project_id',
        'rated_by',
        'score',
        'comment',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'integer',
        ];
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function rater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rated_by');
    }
}
