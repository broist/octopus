<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Naptár-jelszó: eszközönkénti, visszavonható hitelesítő a CalDAV-hoz.
 *
 * Hatóköre szándékosan szűk — csak a saját naptárat éri el, weben nem lehet
 * vele belépni, és fiókbeállítást nem módosíthat. Így egy kiszivárgott kulcs
 * legrosszabb esetben a naptárbejegyzéseket teszi ki, nem a teljes fiókot.
 */
class CalendarCredential extends Model
{
    /**
     * Az összetéveszthető karakterek (0/o, 1/l/i) kihagyva — a kulcsot
     * ritkán, de előfordul, hogy kézzel kell begépelni.
     */
    private const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

    private const GROUPS = 4;

    private const GROUP_LENGTH = 5;

    protected $fillable = [
        'user_id',
        'name',
        'token_hash',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Új naptár-jelszó. A nyílt kulcs CSAK itt létezik — utána már nem
     * visszanyerhető, ezért a hívónak azonnal meg kell jelenítenie vagy a
     * konfigurációs profilba írnia.
     *
     * @return array{0: self, 1: string} [rekord, nyílt kulcs]
     */
    public static function issue(User $user, string $name, ?Carbon $expiresAt = null): array
    {
        $token = self::randomToken();

        $credential = self::create([
            'user_id' => $user->id,
            'name' => $name,
            'token_hash' => self::hash($token),
            'expires_at' => $expiresAt,
        ]);

        return [$credential, $token];
    }

    /**
     * A felhasználó élő kulcsai közül az, amelyik illeszkedik — vagy null.
     *
     * A kulcsok száma felhasználónként néhány darab, ezért végigmegyünk
     * rajtuk; a hash_equals konstans idejű, így az összehasonlítás nem
     * szivárogtat időzítésen keresztül.
     */
    public static function match(User $user, string $token): ?self
    {
        $hash = self::hash($token);

        foreach ($user->calendarCredentials()->active()->get() as $credential) {
            if (hash_equals($credential->token_hash, $hash)) {
                return $credential;
            }
        }

        return null;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('revoked_at')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function revoke(): void
    {
        $this->forceFill(['revoked_at' => now()])->save();
    }

    /**
     * Használat rögzítése — a felhasználó a profilján látja, mikor és honnan
     * szinkronizált utoljára az eszköz, így az idegen hozzáférés feltűnik.
     *
     * A CalDAV-kliens percenként hitelesít, ezért óránként egyszer írunk.
     */
    public function touchUsage(?string $ip): void
    {
        if ($this->last_used_at !== null && $this->last_used_at->gt(now()->subHour()) && $this->last_ip === $ip) {
            return;
        }

        $this->forceFill(['last_used_at' => now(), 'last_ip' => $ip])->saveQuietly();
    }

    /**
     * Négy ötös csoport, pl. „k7m2p-x9q4r-2wn8v-h5tz3” — kb. 99 bit entrópia.
     */
    public static function randomToken(): string
    {
        $groups = [];

        for ($g = 0; $g < self::GROUPS; $g++) {
            $group = '';
            for ($i = 0; $i < self::GROUP_LENGTH; $i++) {
                $group .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
            $groups[] = $group;
        }

        return implode('-', $groups);
    }

    private static function hash(string $token): string
    {
        return hash('sha256', trim($token));
    }
}
