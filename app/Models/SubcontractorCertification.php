<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Alvállalkozói jogi/adminisztratív dokumentum lejárati figyeléssel
 * (szerződés, felelősségbiztosítás, engedély, tanúsítvány, kamarai reg.).
 */
class SubcontractorCertification extends Model
{
    protected $fillable = [
        'partner_id',
        'type',
        'name',
        'issuer',
        'valid_from',
        'valid_until',
        'note',
        'disk',
        'file_path',
        'original_filename',
        'mime_type',
        'size_bytes',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'valid_from' => 'date',
            'valid_until' => 'date',
            'size_bytes' => 'integer',
        ];
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Lejárati állapot: 'ok' | 'soon' (N napon belül lejár) | 'expired'.
     * Dátum nélküli tétel (pl. határozatlan) mindig 'ok'.
     */
    public function expiryStatus(int $soonDays = 30): string
    {
        if ($this->valid_until === null) {
            return 'ok';
        }

        if ($this->valid_until->isPast()) {
            return 'expired';
        }

        return $this->valid_until->lte(today()->addDays($soonDays)) ? 'soon' : 'ok';
    }

    public function hasFile(): bool
    {
        return $this->file_path !== null;
    }
}
