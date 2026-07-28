<?php

namespace App\Caldav;

use App\Models\CalendarCredential;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Sabre\DAV\Auth\Backend\AbstractBasic;

/**
 * CalDAV-hitelesítés naptár-jelszóval.
 *
 * A CalDAV-kliensek csak basic autht tudnak, MFA-t nem, ezért NEM a fiók
 * jelszavát fogadjuk el, hanem eszközönként kiadott, szűk hatókörű,
 * visszavonható kulcsot. A kulcs kibocsátásához be kell lépni, tehát az MFA
 * továbbra is véd — csak nem a szinkron-kérésenként, ami amúgy sem lenne
 * megoldható egy háttérben futó folyamatnál.
 */
class AuthBackend extends AbstractBasic
{
    /** Percenkénti sikertelen próbálkozás IP-nként, mielőtt elzárjuk. */
    private const MAX_ATTEMPTS = 10;

    private ?User $user = null;

    private ?string $clientIp;

    public function __construct(?string $clientIp)
    {
        $this->clientIp = $clientIp;
        $this->principalPrefix = 'principals/';
        $this->realm = 'Octopus naptár';
    }

    protected function validateUserPass($username, $password): bool
    {
        $throttleKey = 'caldav-auth:'.($this->clientIp ?? 'ismeretlen');

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            return false;
        }

        $user = User::query()
            ->where('email', $username)
            ->where('is_active', true)
            ->first();

        $credential = $user ? CalendarCredential::match($user, (string) $password) : null;

        if ($credential === null) {
            RateLimiter::hit($throttleKey, 60);

            return false;
        }

        RateLimiter::clear($throttleKey);
        $credential->touchUsage($this->clientIp);

        $this->user = $user;

        return true;
    }

    /**
     * A hitelesített felhasználó — a backendek innen veszik, kinek a naptárát
     * kell kiszolgálni.
     */
    public function authenticatedUser(): ?User
    {
        return $this->user;
    }
}
