<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Egy csak-olvasható naptárelem normalizált alakja.
 *
 * A határidő-naptár hat különböző modulból szedi össze a tartalmát (fázis,
 * projekt-átadás, feladat, anyagszállítás, gépfoglalás, szabadság) — ez az
 * osztály hozza őket közös nevezőre, hogy egyetlen szerializáló elég legyen.
 */
class CalendarFeedItem
{
    public function __construct(
        /** Stabil iCalendar UID, pl. „feladat-17@octopus”. */
        public readonly string $uid,
        public readonly string $summary,
        public readonly CarbonImmutable $startsOn,
        /** Az utolsó nap, amelyen az elem tart (inkluzív). */
        public readonly CarbonImmutable $endsOn,
        public readonly ?string $description = null,
        public readonly ?string $location = null,
        /** Az ETag alapja — a forrásrekord utolsó módosítása. */
        public readonly ?CarbonInterface $modifiedAt = null,
        /** Naptárnézetben megkülönböztető jelölés, pl. „fazis”, „feladat”. */
        public readonly string $kind = 'egyeb',
        /** Igaz esetén az elem nem foglalja le a napot a szabad/foglalt nézetben. */
        public readonly bool $transparent = true,
    ) {}

    public function etag(): string
    {
        return '"'.md5($this->uid.'|'.($this->modifiedAt?->getTimestamp() ?? 0)).'"';
    }

    public function objectName(): string
    {
        return $this->uid.'.ics';
    }
}
