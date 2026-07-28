<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;

/**
 * Apple konfigurációs profil (.mobileconfig) a CalDAV-fiókhoz.
 *
 * Ugyanaz a formátum, amivel a céges MDM-rendszerek osztanak ki fiókokat: a
 * felhasználó megnyitja, telepíti, és a naptár beáll — a naptár-jelszót soha
 * nem látja és nem gépeli be, tehát nem is kerülhet e-mailbe vagy cetlire.
 *
 * A fájl a kulcsot nyílt szöveggel tartalmazza, ezért kizárólag bejelentkezve,
 * HTTPS-en, egyszeri letöltésként adjuk ki, és minden letöltéshez FRISS
 * kulcsot generálunk.
 */
class AppleCalendarProfile
{
    private const ORGANIZATION = 'AcuWall';

    private const IDENTIFIER = 'hu.acuwall.octopus.caldav';

    public function build(User $user, string $deviceName, string $token): string
    {
        $url = parse_url(config('app.url'));

        $host = $url['host'] ?? 'localhost';
        $useSsl = ($url['scheme'] ?? 'https') === 'https';
        $port = $url['port'] ?? ($useSsl ? 443 : 80);

        $accountUuid = (string) Str::uuid();
        $profileUuid = (string) Str::uuid();

        $payload = [
            'PayloadContent' => [[
                'PayloadType' => 'com.apple.caldav.account',
                'PayloadVersion' => 1,
                'PayloadIdentifier' => self::IDENTIFIER.'.account.'.$accountUuid,
                'PayloadUUID' => $accountUuid,
                'PayloadDisplayName' => 'Octopus naptár',
                'CalDAVAccountDescription' => 'Octopus',
                'CalDAVHostName' => $host,
                'CalDAVPort' => (int) $port,
                'CalDAVUseSSL' => $useSsl,
                'CalDAVUsername' => $user->email,
                'CalDAVPassword' => $token,
                'CalDAVPrincipalURL' => '/caldav/principals/'.$user->email.'/',
            ]],
            'PayloadType' => 'Configuration',
            'PayloadVersion' => 1,
            'PayloadIdentifier' => self::IDENTIFIER,
            'PayloadUUID' => $profileUuid,
            'PayloadOrganization' => self::ORGANIZATION,
            'PayloadDisplayName' => 'Octopus naptár – '.$deviceName,
            'PayloadDescription' => 'Beállítja az Octopus naptár-szinkront ezen az eszközön. '
                .'Eltávolítás: Beállítások → Általános → VPN és eszközkezelés.',
            // A felhasználó bármikor eltávolíthatja a telefonjáról; a
            // kulcsot ettől függetlenül az Octopusban is vissza kell vonni.
            'PayloadRemovalDisallowed' => false,
        ];

        return $this->plist($payload);
    }

    public function fileName(string $deviceName): string
    {
        $slug = Str::slug($deviceName) ?: 'eszkoz';

        return 'octopus-naptar-'.$slug.'.mobileconfig';
    }

    private function plist(array $payload): string
    {
        return implode("\n", [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
            '<plist version="1.0">',
            $this->encode($payload, 0),
            '</plist>',
            '',
        ]);
    }

    private function encode(mixed $value, int $depth): string
    {
        $pad = str_repeat('    ', $depth);

        if (is_bool($value)) {
            return $pad.($value ? '<true/>' : '<false/>');
        }

        if (is_int($value)) {
            return $pad.'<integer>'.$value.'</integer>';
        }

        if (is_array($value) && array_is_list($value)) {
            $items = array_map(fn ($item) => $this->encode($item, $depth + 1), $value);

            return $pad."<array>\n".implode("\n", $items)."\n".$pad.'</array>';
        }

        if (is_array($value)) {
            $lines = [];
            foreach ($value as $key => $item) {
                $lines[] = str_repeat('    ', $depth + 1).'<key>'.$this->escape((string) $key).'</key>';
                $lines[] = $this->encode($item, $depth + 1);
            }

            return $pad."<dict>\n".implode("\n", $lines)."\n".$pad.'</dict>';
        }

        return $pad.'<string>'.$this->escape((string) $value).'</string>';
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
