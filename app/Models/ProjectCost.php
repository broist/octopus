<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tényleges (nem anyag) költség egy projekten (spec §9): alvállalkozó, gép, egyéb.
 * Opcionálisan bejövő számla (határidővel, kifizetettséggel, csatolt fájllal).
 */
class ProjectCost extends Model
{
    protected $fillable = [
        'project_id',
        'category',
        'partner_id',
        'description',
        'amount',
        'incurred_on',
        'is_invoice',
        'due_on',
        'is_paid',
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
            'amount' => 'decimal:2',
            'incurred_on' => 'date:Y-m-d',
            'due_on' => 'date:Y-m-d',
            'is_invoice' => 'boolean',
            'is_paid' => 'boolean',
            'size_bytes' => 'integer',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function hasFile(): bool
    {
        return $this->file_path !== null;
    }

    /**
     * Kifizetetlen bejövő számlák, amelyek határideje lejárt.
     */
    public function scopeOverdueUnpaid(Builder $query): Builder
    {
        return $query->where('is_invoice', true)
            ->where('is_paid', false)
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<', today());
    }
}
