<?php

namespace App\Models;

use App\Support\MemberLedger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Közös (céges) költség, amit a tagok osztanak el egymás között.
 */
class SharedCost extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title',
        'category',
        'period_month',
        'due_on',
        'issued_on',
        'currency',
        'amount',
        'net_amount',
        'vat_amount',
        'exchange_rate',
        'amount_huf',
        'supplier_name',
        'invoice_number',
        'source',
        'document_id',
        'recurring_cost_id',
        'needs_review',
        'parse_note',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'period_month' => 'date',
            'due_on' => 'date',
            'issued_on' => 'date',
            'amount' => 'float',
            'net_amount' => 'float',
            'vat_amount' => 'float',
            'exchange_rate' => 'float',
            'amount_huf' => 'float',
            'needs_review' => 'boolean',
        ];
    }

    public function shares(): HasMany
    {
        return $this->hasMany(SharedCostShare::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(MemberPayment::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Elszámolási időszak emberi alakban, pl. „2026. június”. */
    public function periodLabel(): ?string
    {
        if (! $this->period_month) {
            return null;
        }

        return $this->period_month->year.'. '.MemberLedger::MONTHS_HU[$this->period_month->month];
    }
}
