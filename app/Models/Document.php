<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use HasFactory;
    use SoftDeletes;

    public const CATEGORIES = [
        'terv' => 'Tervrajz',
        'engedely' => 'Engedély',
        'szerzodes' => 'Szerződés',
        'teljesitesigazolas' => 'Teljesítésigazolás',
        'foto' => 'Fotó',
        'egyeb' => 'Egyéb',
    ];

    protected $fillable = [
        'title',
        'category',
        'project_id',
        'partner_id',
        'description',
        'uploaded_by',
    ];

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class)->orderByDesc('version_number');
    }

    public function currentVersion(): HasOne
    {
        return $this->hasOne(DocumentVersion::class)->where('is_current', true);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Hibrid tárolás (spec §10): tervrajz S3-ra megy, HA van S3 konfigurálva;
     * minden más (és S3 hiányában minden) a szerver-lemezre. A felhasználó felé
     * átlátszó — a letöltés/megnyitás egységes.
     */
    public static function diskForCategory(string $category): string
    {
        $s3Configured = (bool) config('filesystems.disks.plans.key');

        return ($category === 'terv' && $s3Configured) ? 'plans' : 'documents';
    }
}
