<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Gép / eszköz (spec §7). Törzsadat + aktuális státusz/hely + felelős személy,
 * valamint a két lejárati figyeléssel követett dátum (esedékes szerviz és a
 * műszaki vizsga/érvényesség). A foglalás, a karbantartási előzmény és a
 * dokumentumok külön modellekben (a Subcontractor mintája).
 */
class Machine extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'kind',
        'identifier',
        'manufacture_year',
        'purchased_on',
        'ownership',
        'rental_source',
        'status',
        'location',
        'responsible_user_id',
        'next_service_on',
        'inspection_valid_until',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'manufacture_year' => 'integer',
            'purchased_on' => 'date',
            'next_service_on' => 'date',
            'inspection_valid_until' => 'date',
        ];
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(MachineMaintenance::class)->orderByDesc('performed_on')->orderByDesc('id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(MachineDocument::class)->latest();
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(MachineBooking::class)->orderBy('starts_on');
    }

    /**
     * Kereső név, azonosító/rendszám és aktuális hely mezőkben.
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        if ($term === '') {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            foreach (['name', 'identifier', 'location'] as $col) {
                $q->orWhere($col, 'ilike', "%{$term}%");
            }
        });
    }

    public function scopeKind(Builder $query, string $kind): Builder
    {
        return $kind !== '' ? $query->where('kind', $kind) : $query;
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $status !== '' ? $query->where('status', $status) : $query;
    }

    /**
     * Egy lejárattal figyelt dátum állapota: 'ok' | 'soon' | 'expired'.
     * Dátum nélkül mindig 'ok' (nincs figyelendő lejárat).
     */
    public static function dateStatus(?\Illuminate\Support\Carbon $date, int $soonDays = 30): string
    {
        if ($date === null) {
            return 'ok';
        }

        if ($date->isPast()) {
            return 'expired';
        }

        return $date->lte(today()->addDays($soonDays)) ? 'soon' : 'ok';
    }

    public function serviceStatus(int $soonDays = 30): string
    {
        return self::dateStatus($this->next_service_on, $soonDays);
    }

    public function inspectionStatus(int $soonDays = 30): string
    {
        return self::dateStatus($this->inspection_valid_until, $soonDays);
    }
}
