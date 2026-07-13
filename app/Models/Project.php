<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * Státusz-folyamat (spec §5/2): a pontos lista később finomítható.
     */
    public const STATUSES = [
        'ajanlat' => 'Ajánlati fázis',
        'szerzodott' => 'Szerződött',
        'folyamatban' => 'Folyamatban',
        'atadas' => 'Átadás',
        'lezart' => 'Lezárt',
    ];

    public const CONSTRUCTION_TYPES = [
        'ujepites' => 'Új építés',
        'felujitas' => 'Felújítás',
        'bovites' => 'Bővítés',
        'egyeb' => 'Egyéb',
    ];

    protected $fillable = [
        'parent_id',
        'code',
        'name',
        'client_id',
        'project_manager_id',
        'status',
        'construction_type',
        'location_city',
        'location_address',
        'latitude',
        'longitude',
        'starts_on',
        'ends_on',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Relations                                                           */
    /* ------------------------------------------------------------------ */

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function subprojects(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Partner::class, 'client_id');
    }

    public function projectManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'project_manager_id');
    }

    public function phases(): HasMany
    {
        return $this->hasMany(ProjectPhase::class)->orderBy('sort_order');
    }

    /**
     * Az alprojektek fázisai (pl. csúszás-jelzéshez a főprojekten).
     */
    public function subprojectPhases(): HasManyThrough
    {
        return $this->hasManyThrough(
            ProjectPhase::class,
            self::class,
            'parent_id',    // projects.parent_id
            'project_id',   // project_phases.project_id
        );
    }

    public function activities(): HasMany
    {
        return $this->hasMany(ProjectActivity::class)->latest();
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * Projekt-készültség: a saját fázisok átlaga; ha nincsenek, az
     * alprojektek fázisainak átlaga.
     */
    public function progress(): int
    {
        $phases = $this->relationLoaded('phases') ? $this->phases : $this->phases()->get();

        if ($phases->isNotEmpty()) {
            return (int) round($phases->avg('progress'));
        }

        $subAvg = $this->subprojectPhases()->avg('progress');
        if ($subAvg !== null) {
            return (int) round((float) $subAvg);
        }

        return $this->status === 'lezart' ? 100 : 0;
    }

    /**
     * Bejegyzés a projekt-naplóba (tevékenységfolyam).
     */
    public function logActivity(string $type, string $description, ?User $user = null): void
    {
        $this->activities()->create([
            'user_id' => $user?->id ?? auth()->id(),
            'type' => $type,
            'description' => $description,
        ]);
    }
}
