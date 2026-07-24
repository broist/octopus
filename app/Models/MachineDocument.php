<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Géphez csatolt dokumentum (gépkönyv, biztosítás, vizsgadokumentum, számla) —
 * a SubcontractorDocument mintájára, hibrid S3/local tárolással.
 */
class MachineDocument extends Model
{
    protected $fillable = [
        'machine_id',
        'category',
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
            'size_bytes' => 'integer',
        ];
    }

    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function isImage(): bool
    {
        return str_starts_with((string) $this->mime_type, 'image/');
    }
}
