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
