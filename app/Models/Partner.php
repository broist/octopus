<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Shared partner record: client / supplier / subcontractor role flags on one
 * row (spec §5 – no data duplication between CRM and Subcontractors).
 */
class Partner extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'is_company',
        'is_client',
        'is_supplier',
        'is_subcontractor',
        'contact_name',
        'email',
        'phone',
        'tax_id',
        'address',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'is_company' => 'boolean',
            'is_client' => 'boolean',
            'is_supplier' => 'boolean',
            'is_subcontractor' => 'boolean',
        ];
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'client_id');
    }

    public function scopeClients(Builder $query): Builder
    {
        return $query->where('is_client', true);
    }
}
