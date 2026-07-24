<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Munkavédelmi nyilvántartás bejegyzés (spec §12): oktatás, bejárás, esemény
 * vagy baleset — dátummal, leírással, résztvevőkkel, opcionálisan projekthez.
 */
class SafetyRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'project_id',
        'type',
        'occurred_on',
        'title',
        'description',
        'participants',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'occurred_on' => 'date:Y-m-d',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
