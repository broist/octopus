<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy „megnyitás asztali Office-ban” munkamenet.
 *
 * A megnyitó URL-ben lévő jegy maga a jogosultság — mint egy jelszó-visszaállító
 * linknél. Ezért szűk a hatóköre: EGY dokumentum, EGY felhasználó, néhány óra.
 * A mentés jogát a jegy nem hordozza: a PUT-nál a mappa-jogosultságot minden
 * alkalommal újra ellenőrizzük, tehát a jogosultság elvétele azonnal hat.
 */
class DocumentEditSession extends Model
{
    /** Meddig érvényes egy megnyitó link (egy hosszú munkanapra elég). */
    public const TTL_HOURS = 12;

    protected $fillable = [
        'document_id',
        'user_id',
        'token_hash',
        'version_id',
        'last_used_at',
        'last_ip',
        'expires_at',
        'revoked_at',
    ];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'version_id');
    }

    /**
     * Új munkamenet. A nyílt jegy CSAK itt létezik — utána már nem
     * visszanyerhető, a hívónak azonnal a megnyitó linkbe kell tennie.
     *
     * @return array{0: self, 1: string} [munkamenet, nyílt jegy]
     */
    public static function issue(User $user, Document $document): array
    {
        // A lejártakat itt takarítjuk: nincs miattuk külön ütemezett feladat.
        self::where('expires_at', '<', now()->subDay())->delete();

        $token = bin2hex(random_bytes(24));

        $session = self::create([
            'document_id' => $document->id,
            'user_id' => $user->id,
            'token_hash' => self::hash($token),
            'expires_at' => now()->addHours(self::TTL_HOURS),
        ]);

        return [$session, $token];
    }

    /** Az érvényes munkamenet a nyílt jegy alapján — vagy null. */
    public static function findActive(string $token): ?self
    {
        if (! preg_match('/^[a-f0-9]{48}$/', $token)) {
            return null;
        }

        return self::query()
            ->active()
            ->where('token_hash', self::hash($token))
            ->with(['document.folder', 'user'])
            ->first();
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('revoked_at')->where('expires_at', '>', now());
    }

    /**
     * Használat rögzítése. Az Office egyetlen mentésnél is több kérést küld
     * (LOCK, PUT, PROPFIND…), ezért ritkítunk.
     */
    public function touchUsage(?string $ip): void
    {
        if ($this->last_used_at !== null && $this->last_used_at->gt(now()->subMinutes(5))) {
            return;
        }

        $this->forceFill(['last_used_at' => now(), 'last_ip' => $ip])->saveQuietly();
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
