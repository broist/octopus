<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Hiba / hiányosság (spec §12): feltárt hiba leírással, fotóval, felelőssel,
 * határidővel, státusszal. Köthető ellenőrzéshez; egy kattintással feladattá
 * alakítható (task_id).
 */
class Defect extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'project_id',
        'inspection_id',
        'title',
        'description',
        'severity',
        'status',
        'responsible_user_id',
        'due_on',
        'task_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'due_on' => 'date:Y-m-d',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(Inspection::class);
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(DefectPhoto::class);
    }

    public function isOverdue(): bool
    {
        return $this->status !== 'lezart'
            && $this->due_on !== null
            && $this->due_on->isPast()
            && ! $this->due_on->isToday();
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $status !== '' ? $query->where('status', $status) : $query;
    }
}
