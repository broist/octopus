<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Anyagtörzs (spec §8): név, kategória, mértékegység, opcionális cikkszám.
 * A konkrét beszerzések a MaterialProcurement modellben (projekthez kötve).
 */
class Material extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'category',
        'unit',
        'sku',
        'note',
    ];

    public function procurements(): HasMany
    {
        return $this->hasMany(MaterialProcurement::class);
    }

    /**
     * Kereső név és cikkszám mezőkben.
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        if ($term === '') {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('name', 'ilike', "%{$term}%")
                ->orWhere('sku', 'ilike', "%{$term}%");
        });
    }

    public function scopeCategory(Builder $query, string $category): Builder
    {
        return $category !== '' ? $query->where('category', $category) : $query;
    }
}
