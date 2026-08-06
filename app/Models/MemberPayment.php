<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tagi kölcsön befizetés a céges bankszámlára.
 */
class MemberPayment extends Model
{
    protected $fillable = [
        'company_member_id',
        'shared_cost_id',
        'paid_on',
        'currency',
        'amount',
        'exchange_rate',
        'amount_huf',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'paid_on' => 'date',
            'amount' => 'float',
            'exchange_rate' => 'float',
            'amount_huf' => 'float',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(CompanyMember::class, 'company_member_id');
    }

    public function cost(): BelongsTo
    {
        return $this->belongsTo(SharedCost::class, 'shared_cost_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
