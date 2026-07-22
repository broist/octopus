<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy árajánlat jóváhagyott verziójának pillanatképe.
 */
class QuoteVersion extends Model
{
    protected $fillable = [
        'quote_id',
        'version',
        'data',
        'approved_at',
        'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'approved_at' => 'datetime',
        ];
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }
}
