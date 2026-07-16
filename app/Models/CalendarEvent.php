<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CalendarEvent extends Model
{
    public const TYPES = [
        'beosztas' => 'Beosztás (munkavégzés)',
        'szallitas' => 'Szállítás / anyagbeérkezés',
        'esemeny' => 'Esemény',
        'szemelyes' => 'Személyes',
    ];

    protected $fillable = [
        'title',
        'type',
        'project_id',
        'starts_on',
        'ends_on',
        'start_time',
        'end_time',
        'location',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'calendar_event_user');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Személyes bejegyzést csak a létrehozója lát (saját naptár réteg).
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where(function ($q) use ($user) {
            $q->where('type', '!=', 'szemelyes')
                ->orWhere('created_by', $user->id);
        });
    }

    /**
     * Szerkesztheti/törölheti-e: személyeset csak a gazdája; egyébként
     * scheduling.edit joggal bárki, a létrehozó pedig create joggal is.
     */
    public function canBeManagedBy(User $user): bool
    {
        if ($this->type === 'szemelyes') {
            return $this->created_by === $user->id;
        }

        return $user->can('scheduling.edit')
            || ($this->created_by === $user->id && $user->can('scheduling.create'));
    }
}
