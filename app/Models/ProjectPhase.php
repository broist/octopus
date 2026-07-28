<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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
        'parent_id',
        'name',
        'sort_order',
        'level',
        'wbs',
        'is_group',
        'is_milestone',
        'starts_on',
        'due_on',
        'work_days',
        'progress',
        'completed_on',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date:Y-m-d',
            'due_on' => 'date:Y-m-d',
            'completed_on' => 'date:Y-m-d',
            'progress' => 'integer',
            'work_days' => 'integer',
            'level' => 'integer',
            'is_group' => 'boolean',
            'is_milestone' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * A fölérendelt összegző sor (ütemterv-sablonból hozott munkastruktúra).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order');
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
     * Csak a tényleges munkasorok. Az összegző (csoport) sorok a sablonból
     * hozott munkastruktúra fejlécei: nincs saját határidejük és készültségük,
     * ezért a határidő-figyelésbe és a riportokba nem valók.
     */
    public function scopeWork(Builder $query): void
    {
        $query->where('is_group', false);
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
