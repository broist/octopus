<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Hibához csatolt fotó (spec §12). A DailyReportPhoto mintájára, hibrid
 * tárolással; a document_id a Fájlkezelő tükör-dokumentumát köti.
 */
class DefectPhoto extends Model
{
    protected $fillable = [
        'defect_id',
        'disk',
        'file_path',
        'original_filename',
        'mime_type',
        'size_bytes',
        'document_id',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
        ];
    }

    public function defect(): BelongsTo
    {
        return $this->belongsTo(Defect::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
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
