<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Napi jelentés / Munkanapló bejegyzés (spec §11) — projektenként naponta egy
 * helyszíni napló. Elvégzett munka, akadályok, létszám (saját dolgozók +
 * alvállalkozói brigádok), opcionális anyag-/gépmozgás, automatikus időjárás
 * (a projekt koordinátái alapján, mentéskor rögzítve), valamint helyszíni fotók
 * (a Dokumentumtárba is bekerülve).
 */
class DailyReport extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'project_id',
        'report_date',
        'created_by',
        'work_done',
        'obstacles',
        'own_headcount',
        'material_movement',
        'machine_movement',
        'weather',
        'weather_fetched_at',
    ];

    protected function casts(): array
    {
        return [
            'report_date' => 'date:Y-m-d',
            'own_headcount' => 'integer',
            'weather' => 'array',
            'weather_fetched_at' => 'datetime',
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Relations                                                           */
    /* ------------------------------------------------------------------ */

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Saját dolgozók, akik aznap a helyszínen voltak („kik dolgoztak").
     */
    public function workers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'daily_report_user');
    }

    /**
     * Alvállalkozói brigádok aznapi jelenléte (mely alvállalkozó, hány fővel).
     */
    public function subcontractorCrews(): HasMany
    {
        return $this->hasMany(DailyReportSubcontractor::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(DailyReportPhoto::class);
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * Összlétszám aznap: saját dolgozók + az alvállalkozói brigádok fői.
     */
    public function totalHeadcount(): int
    {
        $crews = $this->relationLoaded('subcontractorCrews')
            ? $this->subcontractorCrews
            : $this->subcontractorCrews()->get();

        return (int) $this->own_headcount + (int) $crews->sum('headcount');
    }

    /**
     * Egy adott projekthez tartozó jelentések, a legfrissebb dátummal elöl.
     */
    public function scopeForProject(Builder $query, int $projectId): Builder
    {
        return $query->where('project_id', $projectId);
    }
}
