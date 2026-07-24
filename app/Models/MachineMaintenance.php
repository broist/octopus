<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Karbantartási előzmény egy géphez (spec §7): mikor mit szervizeltek/javítottak,
 * opcionálisan költséggel és csatolt szervizlappal/számlával.
 */
class MachineMaintenance extends Model
{
    protected $fillable = [
        'machine_id',
        'type',
        'performed_on',
        'description',
        'cost',
        'disk',
        'file_path',
        'original_filename',
        'mime_type',
        'size_bytes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'performed_on' => 'date',
            'cost' => 'decimal:2',
            'size_bytes' => 'integer',
        ];
    }

    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function hasFile(): bool
    {
        return $this->file_path !== null;
    }
}
