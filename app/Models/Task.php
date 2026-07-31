<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use HasFactory;

    public const STATUSES = [
        'teendo' => 'Teendő',
        'folyamatban' => 'Folyamatban',
        'kesz' => 'Kész',
    ];

    public const PRIORITIES = [
        'alacsony' => 'Alacsony',
        'kozepes' => 'Közepes',
        'magas' => 'Magas',
    ];

    protected $fillable = [
        'title',
        'description',
        'project_id',
        'status',
        'priority',
        'due_on',
        'completed_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'due_on' => 'date:Y-m-d',
            'completed_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskAttachment::class)->latest();
    }

    /** Idővonal: hozzászólások és státuszváltások időrendben (legrégebbi elöl). */
    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class)->oldest('id');
    }

    /**
     * Státuszváltás rögzítése az idővonalon. Csak tényleges váltásnál ír be
     * sort, hogy a mentés gomb ismételt megnyomása ne szemetelje tele.
     */
    public function logStatusChange(?string $from, string $to, ?User $user): void
    {
        if ($from === $to) {
            return;
        }

        $this->comments()->create([
            'user_id' => $user?->id,
            'kind' => TaskComment::KIND_STATUS,
            'from_status' => $from,
            'to_status' => $to,
        ]);
    }

    public function isOverdue(): bool
    {
        return $this->status !== 'kesz'
            && $this->due_on !== null
            && $this->due_on->isPast()
            && ! $this->due_on->isToday();
    }

    /**
     * A felhasználó módosíthatja-e a feladat státuszát: modul-jogosultsággal
     * bárki, e nélkül a saját (rá kiosztott) feladatát bárki kipipálhatja —
     * ez kell majd az esti 17:00-s checkboxos riporthoz is (spec §11).
     */
    public function canBeMovedBy(User $user): bool
    {
        return $user->can('tasks.edit')
            || $this->assignees->contains(fn ($u) => $u->id === $user->id);
    }
}
