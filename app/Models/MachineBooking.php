<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Gépfoglalás (spec §7 + §3): egy gép egy projektre foglalva egy időszakra.
 * Megjelenik az Ütemezés naptárban (csak-olvasható réteg), és ütközés-jelzést
 * ad, ha ugyanazt a gépet átfedő időszakra foglalják.
 */
class MachineBooking extends Model
{
    protected $fillable = [
        'machine_id',
        'project_id',
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

    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Az adott napot lefedő foglalások.
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
