<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Alvállalkozóhoz csatolt dokumentum (szerződés, teljesítésigazolás, bejövő
 * számla, egyéb) — a TaskAttachment mintájára, hibrid S3/local tárolással.
 */
class SubcontractorDocument extends Model
{
    protected $fillable = [
        'partner_id',
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

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
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
