<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ismétlődő közös költség sablonja (pl. ChatGPT-előfizetés).
 */
class RecurringSharedCost extends Model
{
    protected $fillable = [
        'title',
        'category',
        'currency',
        'amount',
        'exchange_rate',
        'due_day',
        'start_month',
        'is_active',
        'shares',
        'last_period',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'exchange_rate' => 'float',
            'due_day' => 'integer',
            'start_month' => 'date',
            'last_period' => 'date',
            'is_active' => 'boolean',
            'shares' => 'array',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * A sablonban rögzített felosztás: tag-azonosító → százalék.
     *
     * @return array<int, float>
     */
    public function shareMap(): array
    {
        $map = [];

        foreach ($this->shares ?? [] as $row) {
            $id = (int) ($row['member_id'] ?? 0);
            if ($id > 0) {
                $map[$id] = (float) ($row['percent'] ?? 0);
            }
        }

        return $map;
    }
}
