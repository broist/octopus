<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy bejegyzés a feladat idővonalán: vagy felhasználói hozzászólás
 * (kind = comment), vagy automatikusan rögzített státuszváltás
 * (kind = status, from_status → to_status).
 */
class TaskComment extends Model
{
    public const KIND_COMMENT = 'comment';
    public const KIND_STATUS = 'status';

    protected $fillable = [
        'task_id',
        'user_id',
        'kind',
        'body',
        'from_status',
        'to_status',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** A szerző szerkesztheti/törölheti a saját hozzászólását. */
    public function canBeDeletedBy(User $user): bool
    {
        return $this->kind === self::KIND_COMMENT
            && ($this->user_id === $user->id || $user->can('tasks.delete'));
    }

    /** Az idővonal egy eleme a frontendnek. */
    public function toTimelineArray(?User $viewer = null): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'body' => $this->body,
            'from_status' => $this->from_status,
            'to_status' => $this->to_status,
            'user' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'created_at' => $this->created_at->toIso8601String(),
            'can_delete' => $viewer ? $this->canBeDeletedBy($viewer) : false,
        ];
    }
}
