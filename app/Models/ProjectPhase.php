<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectPhase extends Model
{
    use HasFactory;

    /** Függőség-típusok (elődhöz képest). */
    public const DEP_TYPES = [
        'bk' => 'Befejezés → Kezdés',
        'kk' => 'Kezdés → Kezdés',
        'bb' => 'Befejezés → Befejezés',
        'kb' => 'Kezdés → Befejezés',
    ];

    protected $fillable = [
        'project_id',
        'name',
        'sort_order',
        'starts_on',
        'due_on',
        'work_days',
        'progress',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date:Y-m-d',
            'due_on' => 'date:Y-m-d',
            'progress' => 'integer',
            'work_days' => 'integer',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Amikre ez a fázis vár (Gantt-függőségek), típussal és eltolással.
     */
    public function dependencies(): BelongsToMany
    {
        return $this->belongsToMany(
            self::class,
            'phase_dependencies',
            'phase_id',
            'depends_on_id'
        )->withPivot(['dep_type', 'lag_days']);
    }

    /**
     * Amik erre a fázisra várnak.
     */
    public function dependents(): BelongsToMany
    {
        return $this->belongsToMany(
            self::class,
            'phase_dependencies',
            'depends_on_id',
            'phase_id'
        );
    }

    public function resources(): HasMany
    {
        return $this->hasMany(PhaseResource::class)->orderBy('id');
    }

    /**
     * Csúszik-e: lejárt határidő, de nincs kész.
     */
    public function isOverdue(): bool
    {
        return $this->progress < 100
            && $this->due_on !== null
            && $this->due_on->isPast()
            && ! $this->due_on->isToday();
    }
}
