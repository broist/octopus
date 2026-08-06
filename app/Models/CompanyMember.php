<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A cég egy tagja (tulajdonosa) a tagi kölcsön nyilvántartásban.
 */
class CompanyMember extends Model
{
    protected $fillable = [
        'name',
        'user_id',
        'default_share',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'default_share' => 'float',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function shares(): HasMany
    {
        return $this->hasMany(SharedCostShare::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(MemberPayment::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Tag-e a felhasználó (a nyilvántartás láthatóságához).
     */
    public static function isMember(User $user): bool
    {
        return self::query()->active()->where('user_id', $user->id)->exists();
    }
}
