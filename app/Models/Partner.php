<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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

    /**
     * A partner szerepei — a szűrő és az űrlap közös forrása.
     */
    public const ROLES = [
        'is_client' => 'Megrendelő',
        'is_supplier' => 'Beszállító',
        'is_subcontractor' => 'Alvállalkozó',
    ];

    protected $fillable = [
        'name',
        'is_company',
        'is_client',
        'is_supplier',
        'is_subcontractor',
        'trade',
        'crew_size',
        'availability_note',
        'source',
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
            'crew_size' => 'integer',
        ];
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'client_id');
    }

    public function certifications(): HasMany
    {
        return $this->hasMany(SubcontractorCertification::class)->orderByRaw('valid_until is null, valid_until');
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(SubcontractorRating::class)->latest();
    }

    public function subcontractorDocuments(): HasMany
    {
        return $this->hasMany(SubcontractorDocument::class)->latest();
    }

    /**
     * Azok a projektek, amelyeken az alvállalkozó dolgozik (project_subcontractors).
     */
    public function assignedProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_subcontractors')
            ->withPivot(['id', 'scope', 'note'])
            ->withTimestamps();
    }

    public function scopeClients(Builder $query): Builder
    {
        return $query->where('is_client', true);
    }

    public function scopeSubcontractors(Builder $query): Builder
    {
        return $query->where('is_subcontractor', true);
    }

    /**
     * Szűrés szakma szerint (partner.trade).
     */
    public function scopeTrade(Builder $query, string $trade): Builder
    {
        return $trade !== '' ? $query->where('trade', $trade) : $query;
    }

    /**
     * Az értékelések átlaga (1–5), null ha még nincs értékelés.
     */
    public function averageRating(): ?float
    {
        $avg = $this->ratings()->avg('score');

        return $avg !== null ? round((float) $avg, 1) : null;
    }

    /**
     * Szűrés szerep szerint (is_client / is_supplier / is_subcontractor).
     */
    public function scopeWithRole(Builder $query, string $role): Builder
    {
        return array_key_exists($role, self::ROLES)
            ? $query->where($role, true)
            : $query;
    }

    /**
     * Kereső név, kapcsolattartó, e-mail, telefon és adószám mezőkben.
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        if ($term === '') {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            foreach (['name', 'contact_name', 'email', 'phone', 'tax_id'] as $col) {
                $q->orWhere($col, 'ilike', "%{$term}%");
            }
        });
    }

    /**
     * A partner aktív szerep-címkéi (chip-ekhez).
     *
     * @return array<int, string>
     */
    public function roleLabels(): array
    {
        $labels = [];
        foreach (self::ROLES as $flag => $label) {
            if ($this->{$flag}) {
                $labels[] = $label;
            }
        }

        return $labels;
    }
}
