<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Egy elvégzett ellenőrzés (spec §12) — egy sablonból (vagy szabadon)
 * példányosított, projektre kötött checklist a tételek eredményével.
 */
class Inspection extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'project_id',
        'checklist_template_id',
        'title',
        'purpose',
        'inspected_on',
        'status',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'inspected_on' => 'date:Y-m-d',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'checklist_template_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InspectionItem::class)->orderBy('sort_order');
    }

    public function defects(): HasMany
    {
        return $this->hasMany(Defect::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * A „nem megfelelt" tételek száma (a hibalistához / összesítéshez).
     */
    public function failedCount(): int
    {
        $items = $this->relationLoaded('items') ? $this->items : $this->items()->get();

        return $items->where('result', 'nem_megfelelt')->count();
    }
}
