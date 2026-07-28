<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

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
        'uid',
        'caldav_uri',
        'raw_ics',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
        ];
    }

    protected static function booted(): void
    {
        // Minden bejegyzésnek van iCalendar UID-je, akkor is, ha az Octopus
        // felületén jött létre — enélkül nem tudnánk kiadni a telefonnak.
        static::creating(function (self $event) {
            $event->uid ??= (string) Str::uuid().'@octopus';
        });
    }

    /**
     * CalDAV ETag: a kliens ebből tudja, változott-e a bejegyzés.
     *
     * Az updated_at-ból származik, mert azt az Eloquent minden mentésnél
     * frissíti — így nincs külön karbantartandó oszlop, ami elavulhatna.
     * A résztvevők pivot-táblás módosítása nem érinti az updated_at-ot,
     * ezért a szinkronizálás után ott külön touch() kell.
     */
    public function etag(): string
    {
        return '"'.md5($this->id.'|'.($this->updated_at?->getTimestamp() ?? 0)).'"';
    }

    /**
     * A CalDAV-ban kiadott fájlnév.
     *
     * Telefonról érkezett bejegyzésnél a kliens által választott nevet
     * használjuk — a CalDAV-ban a fájlnév a kliens tulajdona, és nem
     * feltétlenül egyezik a UID-del.
     */
    public function calendarObjectName(): string
    {
        return $this->caldav_uri ?: $this->uid.'.ics';
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
