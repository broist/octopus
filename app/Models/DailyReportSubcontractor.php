<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy alvállalkozói brigád aznapi jelenléte a napi jelentésben (spec §11).
 */
class DailyReportSubcontractor extends Model
{
    protected $fillable = [
        'daily_report_id',
        'subcontractor_id',
        'headcount',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'headcount' => 'integer',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(DailyReport::class, 'daily_report_id');
    }

    public function subcontractor(): BelongsTo
    {
        return $this->belongsTo(Partner::class, 'subcontractor_id');
    }
}
