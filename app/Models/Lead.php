<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Webes ajánlatkérés (lead) az acuwall.hu űrlapról.
 *
 * Minden beérkező ajánlatkérő e-mailből egy Lead sor és egy hozzá tartozó
 * projekt (ajánlati fázisban) készül. A lead_id (pl. ACW-20260721202340-B9RDE)
 * a duplikáció-védelem kulcsa.
 */
class Lead extends Model
{
    use HasFactory;

    protected $fillable = [
        'lead_id',
        'name',
        'email',
        'phone',
        'location',
        'building_type',
        'area',
        'plot_status',
        'design_needs',
        'planned_start',
        'description',
        'raw_body',
        'source',
        'project_id',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
