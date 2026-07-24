<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A napi jelentéshez csatolt helyszíni fotó (spec §11). A TaskAttachment
 * mintájára, hibrid tárolással; a document_id a Fájlkezelő tükör-dokumentumát
 * köti (spec §10: a helyszíni fotók a Dokumentumtárba is bekerülnek).
 */
class DailyReportPhoto extends Model
{
    protected $fillable = [
        'daily_report_id',
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

    public function report(): BelongsTo
    {
        return $this->belongsTo(DailyReport::class, 'daily_report_id');
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
