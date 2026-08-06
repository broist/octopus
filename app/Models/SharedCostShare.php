<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy közös költség egy tagra eső része.
 */
class SharedCostShare extends Model
{
    protected $fillable = [
        'shared_cost_id',
        'company_member_id',
        'share_percent',
        'amount',
        'amount_huf',
    ];

    protected function casts(): array
    {
        return [
            'share_percent' => 'float',
            'amount' => 'float',
            'amount_huf' => 'float',
        ];
    }

    public function cost(): BelongsTo
    {
        return $this->belongsTo(SharedCost::class, 'shared_cost_id');
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(CompanyMember::class, 'company_member_id');
    }
}
