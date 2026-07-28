<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentVersion extends Model
{
    protected $fillable = [
        'document_id',
        'version_number',
        'is_current',
        'disk',
        'file_path',
        'original_filename',
        'mime_type',
        'size_bytes',
        'note',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'is_current' => 'boolean',
            'version_number' => 'integer',
            'size_bytes' => 'integer',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Böngészőben megjeleníthető-e (kép vagy PDF) az előnézethez.
     *
     * Az SVG szándékosan kimarad: az beágyazott szkriptet futtathatna a saját
     * kiszolgálónkról. Feltölthető és letölthető, csak előnézete nincs.
     */
    public function isPreviewable(): bool
    {
        $mime = (string) $this->mime_type;

        if ($mime === 'image/svg+xml') {
            return false;
        }

        return str_starts_with($mime, 'image/') || $mime === 'application/pdf';
    }
}
