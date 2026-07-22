<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Munkatársi szabadság / távollét. A naptárban is megjelenik (csak olvasható
 * réteg), hogy ne legyen véletlen beosztás távollét alatt.
 */
class StaffAbsence extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'starts_on',
        'ends_on',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Az adott napot (alapból ma) lefedő távollétek.
     */
    public function scopeCovering(Builder $query, string $date): Builder
    {
        return $query->whereDate('starts_on', '<=', $date)
            ->whereDate('ends_on', '>=', $date);
    }

    /**
     * Átfedés a megadott tartománnyal (naptár-réteghez).
     */
    public function scopeOverlapping(Builder $query, string $start, string $end): Builder
    {
        return $query->whereDate('starts_on', '<=', $end)
            ->whereDate('ends_on', '>=', $start);
    }
}
