<?php

namespace App\Support;

/**
 * A telefonra kiadott naptárak.
 *
 * Három rögzített naptár, plusz projektenként egy. A projekt-naptár egyben a
 * hozzárendelés eszköze is: a telefonon a naptár kiválasztásával mondod meg,
 * melyik projekthez tartozik a bejegyzés — az iPhone naptárában nincs
 * „projekt” mező, ez a legkézenfekvőbb helyette.
 *
 * Egy bejegyzés PONTOSAN EGY naptárban szerepel: ha van projektje, akkor a
 * projekt naptárában, egyébként a Személyesben vagy a Munkanaptárban.
 * Enélkül a telefon duplán mutatná.
 */
class CalendarCollections
{
    /** Saját, projekthez nem kötött bejegyzések — teljesen szerkeszthető. */
    public const PERSONAL = 'szemelyes';

    /** Projekt nélküli beosztások és céges események. */
    public const WORK = 'munka';

    /** Határidők más modulokból — a telefon nem írhatja. */
    public const DEADLINES = 'hataridok';

    public const PROJECT_PREFIX = 'projekt-';

    /**
     * @var array<string, array{name: string, description: string, color: string, writable: bool, creatable: bool}>
     */
    public const FIXED = [
        self::PERSONAL => [
            'name' => 'Octopus – Személyes',
            'description' => 'Projekthez nem kötött saját bejegyzések. Telefonról is felvehető.',
            'color' => '#2563EBFF',
            'writable' => true,
            'creatable' => true,
        ],
        self::WORK => [
            'name' => 'Octopus – Munkanaptár',
            'description' => 'Projekt nélküli beosztások és céges események. A meglévők szerkeszthetők, új beosztást az Octopusban kell felvenni.',
            'color' => '#EA580CFF',
            'writable' => true,
            'creatable' => false,
        ],
        self::DEADLINES => [
            'name' => 'Octopus – Határidők',
            'description' => 'Fázis- és feladathatáridők, anyagszállítás, gépfoglalás, szabadság. Csak olvasható.',
            'color' => '#475569FF',
            'writable' => false,
            'creatable' => false,
        ],
    ];

    /**
     * Projekt-naptárak színei. Azonosító szerint választunk, hogy egy projekt
     * színe ne változzon meg attól, hogy egy másikat lezártak.
     *
     * @var array<int, string>
     */
    private const PROJECT_COLORS = [
        '#0F766EFF', '#7C3AEDFF', '#B45309FF', '#BE123CFF',
        '#0369A1FF', '#4D7C0FFF', '#A21CAFFF', '#C2410CFF',
    ];

    public static function isProject(string $key): bool
    {
        return self::projectId($key) !== null;
    }

    /**
     * „projekt-12” → 12; bármi más → null.
     */
    public static function projectId(string $key): ?int
    {
        if (! str_starts_with($key, self::PROJECT_PREFIX)) {
            return null;
        }

        $id = substr($key, strlen(self::PROJECT_PREFIX));

        return ctype_digit($id) && (int) $id > 0 ? (int) $id : null;
    }

    public static function projectKey(int $projectId): string
    {
        return self::PROJECT_PREFIX.$projectId;
    }

    public static function projectColor(int $projectId): string
    {
        return self::PROJECT_COLORS[$projectId % count(self::PROJECT_COLORS)];
    }

    public static function exists(string $key): bool
    {
        return isset(self::FIXED[$key]) || self::isProject($key);
    }

    /**
     * A projekt-naptárba a telefonról is lehet írni — épp ez a lényege.
     */
    public static function isWritable(string $key): bool
    {
        return self::isProject($key) || (self::FIXED[$key]['writable'] ?? false);
    }

    public static function allowsCreate(string $key): bool
    {
        return self::isProject($key) || (self::FIXED[$key]['creatable'] ?? false);
    }

    public static function name(string $key): string
    {
        return self::FIXED[$key]['name'] ?? $key;
    }
}
