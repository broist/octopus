<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Projekthez kötött anyagbeszerzés (spec §8). Státusz: tervezett → megrendelve
 * → beérkezett. A vonalérték = mennyiség × egységár (a projekt tényleges
 * anyagköltségéhez, a Pénzügy modul felé).
 */
class MaterialProcurement extends Model
{
    protected $fillable = [
        'project_id',
        'material_id',
        'supplier_id',
        'status',
        'quantity',
        'unit_price',
        'ordered_on',
        'expected_on',
        'received_on',
        'received_quantity',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'received_quantity' => 'decimal:3',
            'ordered_on' => 'date:Y-m-d',
            'expected_on' => 'date:Y-m-d',
            'received_on' => 'date:Y-m-d',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Partner::class, 'supplier_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * A tétel értéke (mennyiség × egységár), null ha nincs egységár.
     */
    public function lineValue(): ?float
    {
        if ($this->unit_price === null) {
            return null;
        }

        return round((float) $this->quantity * (float) $this->unit_price, 2);
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $status !== '' ? $query->where('status', $status) : $query;
    }

    /**
     * Beszerzések, amelyek megrendeltek vagy már beérkeztek (elkötelezett
     * költség — ez épül be a projekt tényleges anyagköltségébe).
     */
    public function scopeCommitted(Builder $query): Builder
    {
        return $query->whereIn('status', ['megrendelve', 'beerkezett']);
    }

    /**
     * Egy adott napot lefedő szállítás (várható vagy tényleges beérkezés) —
     * a naptár csak-olvasható réteghez.
     */
    public function scopeDeliveringBetween(Builder $query, string $start, string $end): Builder
    {
        return $query->where(function (Builder $q) use ($start, $end) {
            $q->whereBetween('expected_on', [$start, $end])
                ->orWhereBetween('received_on', [$start, $end]);
        });
    }
}
