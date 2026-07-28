<?php

namespace App\Support;

/**
 * A telefonra kiadott naptárak.
 *
 * Szándékosan három külön kollekció, nem egy: a telefonon így külön-külön
 * be- és kikapcsolhatók, és a csak-olvasható tartalom (más modulok adatai)
 * nem keveredik a szerkeszthetővel.
 */
class CalendarCollections
{
    /** Saját személyes bejegyzések — teljesen szerkeszthető a telefonról. */
    public const PERSONAL = 'szemelyes';

    /** Beosztások és céges események — a meglévők módosíthatók, új nem hozható létre. */
    public const WORK = 'munka';

    /** Határidők más modulokból — a telefon nem írhatja. */
    public const DEADLINES = 'hataridok';

    /**
     * @var array<string, array{name: string, description: string, color: string, writable: bool, creatable: bool}>
     */
    public const ALL = [
        self::PERSONAL => [
            'name' => 'Octopus – Személyes',
            'description' => 'Saját bejegyzések. Telefonról is felvehető és szerkeszthető.',
            'color' => '#2563EBFF',
            'writable' => true,
            'creatable' => true,
        ],
        self::WORK => [
            'name' => 'Octopus – Munkanaptár',
            'description' => 'Beosztásaid és a céges események. A meglévők szerkeszthetők, új beosztást az Octopusban kell felvenni.',
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

    public static function exists(string $key): bool
    {
        return isset(self::ALL[$key]);
    }

    public static function isWritable(string $key): bool
    {
        return self::ALL[$key]['writable'] ?? false;
    }

    public static function allowsCreate(string $key): bool
    {
        return self::ALL[$key]['creatable'] ?? false;
    }

    public static function name(string $key): string
    {
        return self::ALL[$key]['name'] ?? $key;
    }
}
