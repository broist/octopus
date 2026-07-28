<?php

namespace App\Caldav;

use App\Models\User;
use Sabre\DAV\Exception\Forbidden;
use Sabre\DAV\PropPatch;
use Sabre\DAVACL\PrincipalBackend\BackendInterface;

/**
 * A CalDAV „principal” (felhasználó) réteg.
 *
 * Szándékosan minimális: mindenki csak a saját principaljához fér hozzá,
 * nincs csoport, nincs megosztás, és nem listázzuk ki a kollégák nevét és
 * e-mail-címét a naptár-végponton keresztül.
 */
class PrincipalBackend implements BackendInterface
{
    private const PREFIX = 'principals';

    public function getPrincipalsByPrefix($prefixPath): array
    {
        if (trim((string) $prefixPath, '/') !== self::PREFIX) {
            return [];
        }

        // Csak a bejelentkezett felhasználó — a principal-lista nem
        // címtárszolgáltatás.
        $user = CalendarContext::user();

        return $user ? [$this->toPrincipal($user)] : [];
    }

    public function getPrincipalByPath($path): ?array
    {
        $email = $this->emailFromPath($path);

        if ($email === null) {
            return null;
        }

        $user = User::query()->where('email', $email)->where('is_active', true)->first();

        return $user ? $this->toPrincipal($user) : null;
    }

    public function updatePrincipal($path, PropPatch $propPatch): void
    {
        // A fiókadatokat az Octopus felületén lehet módosítani; a naptár-kulcs
        // hatóköre szándékosan nem terjed ki erre.
    }

    public function searchPrincipals($prefixPath, array $searchProperties, $test = 'allof'): array
    {
        return [];
    }

    public function findByUri($uri, $principalPrefix): ?string
    {
        if (! str_starts_with($uri, 'mailto:')) {
            return null;
        }

        $user = User::query()
            ->where('email', substr($uri, 7))
            ->where('is_active', true)
            ->first();

        return $user ? self::PREFIX.'/'.$user->email : null;
    }

    public function getGroupMemberSet($principal): array
    {
        return [];
    }

    public function getGroupMembership($principal): array
    {
        return [];
    }

    public function setGroupMemberSet($principal, array $members): void
    {
        throw new Forbidden('A csoporttagság nem módosítható a naptár-végponton keresztül.');
    }

    /**
     * @return array<string, string>
     */
    private function toPrincipal(User $user): array
    {
        return [
            'uri' => self::PREFIX.'/'.$user->email,
            '{DAV:}displayname' => $user->name,
            '{http://sabredav.org/ns}email-address' => $user->email,
        ];
    }

    private function emailFromPath(?string $path): ?string
    {
        $parts = explode('/', trim((string) $path, '/'));

        if (count($parts) !== 2 || $parts[0] !== self::PREFIX) {
            return null;
        }

        return $parts[1] !== '' ? $parts[1] : null;
    }
}
