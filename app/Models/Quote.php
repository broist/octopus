<?php

namespace App\Models;

use App\Services\QuoteCalculator;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Árajánlat (Ajánlatkérő modul). A teljes szerkeszthető szerkezet a `data`
 * JSON mezőben él; a fejléc- és összegző oszlopok ebből származtatva frissülnek.
 */
class Quote extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'quote_number',
        'project_name',
        'client_name',
        'location',
        'status',
        'version',
        'net_offer',
        'gross_offer',
        'data',
        'partner_id',
        'project_id',
        'created_by',
        'approved_at',
        'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'approved_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(QuoteVersion::class)->orderByDesc('version');
    }

    /**
     * A fejléc- és összegző oszlopok szinkronizálása a `data` tartalmából.
     * A `data`-t már be kell állítani a hívás előtt.
     */
    public function syncFromData(): void
    {
        $data = $this->data ?? [];
        $totals = QuoteCalculator::project($data);

        $this->quote_number = $data['quoteNumber'] ?? null;
        $this->project_name = $data['projectName'] ?? 'Névtelen ajánlat';
        $this->client_name = $data['clientName'] ?? null;
        $this->location = $data['location'] ?? null;
        $this->status = $data['status'] ?? 'piszkozat';
        $this->version = (int) ($data['version'] ?? 1);
        $this->net_offer = max(0, (int) $totals['netOffer']);
        $this->gross_offer = max(0, (int) $totals['grossOffer']);
    }
}
