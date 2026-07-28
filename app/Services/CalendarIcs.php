<?php

namespace App\Services;

use App\Models\CalendarEvent;
use Carbon\CarbonImmutable;
use DateTimeImmutable;
use DateTimeZone;
use Sabre\VObject\Component\VCalendar;
use Sabre\VObject\Component\VEvent;
use Sabre\VObject\DateTimeParser;
use Sabre\VObject\Node;
use Sabre\VObject\Property\ICalendar\DateTime;
use Sabre\VObject\Reader;

/**
 * Oda-vissza fordítás az Octopus naptárbejegyzései és az iCalendar (RFC 5545)
 * formátum között — ezt eszi a telefon CalDAV-kliense.
 */
class CalendarIcs
{
    public const TIMEZONE = 'Europe/Budapest';

    private const PRODID = '-//AcuWall//Octopus//HU';

    /**
     * A generált kiegészítést ezzel a sorral választjuk el a felhasználó saját
     * jegyzetétől, hogy a telefonról visszaérkező szövegből le tudjuk vágni.
     */
    private const DESCRIPTION_MARKER = "\n-- Octopus --\n";

    /**
     * Egy szerkeszthető bejegyzés önálló .ics dokumentumként.
     */
    public function fromEvent(CalendarEvent $event): string
    {
        $vcal = $this->document();
        $this->addEvent($vcal, $event);

        return $vcal->serialize();
    }

    /**
     * Egy csak-olvasható elem önálló .ics dokumentumként.
     */
    public function fromFeedItem(CalendarFeedItem $item): string
    {
        $vcal = $this->document();
        $this->addFeedItem($vcal, $item);

        return $vcal->serialize();
    }

    /**
     * Több elem egyetlen dokumentumban — a letölthető / feliratkozós ICS-hez.
     *
     * @param  iterable<CalendarEvent|CalendarFeedItem>  $items
     */
    public function collection(string $name, iterable $items): string
    {
        $vcal = $this->document();
        $vcal->add('X-WR-CALNAME', $name);
        $vcal->add('X-WR-TIMEZONE', self::TIMEZONE);
        // A feliratkozó kliensnek javasolt frissítési gyakoriság. Az iOS
        // figyelembe veszi; a Google Naptár sajnos nem.
        $vcal->add('X-PUBLISHED-TTL', 'PT1H');
        $vcal->add('REFRESH-INTERVAL', 'PT1H', ['VALUE' => 'DURATION']);

        foreach ($items as $item) {
            $item instanceof CalendarEvent
                ? $this->addEvent($vcal, $item)
                : $this->addFeedItem($vcal, $item);
        }

        return $vcal->serialize();
    }

    /**
     * Telefonról érkező .ics → CalendarEvent mezők.
     *
     * A visszaadott tömb a raw_ics-t is tartalmazza: az Octopus adatmodellje
     * nem ismer ismétlődést, emlékeztetőt vagy résztvevőt, ezért az eredetit
     * megőrizzük, és a következő kiadásnál visszaírjuk — így a telefonon
     * beállított ismétlődés nem vész el egy Octopus-oldali szerkesztéskor.
     *
     * @return array<string, mixed>
     *
     * @throws \InvalidArgumentException érvénytelen vagy értelmezhetetlen ICS esetén
     */
    public function toAttributes(string $ics): array
    {
        try {
            $vcal = Reader::read($ics, Reader::OPTION_FORGIVING);
        } catch (\Throwable $e) {
            throw new \InvalidArgumentException('Értelmezhetetlen iCalendar tartalom: '.$e->getMessage(), previous: $e);
        }

        $vevent = $vcal->VEVENT ?? null;

        // Ismétlődő eseménynél több VEVENT is jön (alap + kivételek); az
        // elsőt vesszük alapul, a többit a raw_ics őrzi meg.
        if ($vevent instanceof Node && ! $vevent instanceof VEvent) {
            $vevent = $vevent[0] ?? null;
        }

        if (! $vevent instanceof VEvent) {
            throw new \InvalidArgumentException('Az .ics nem tartalmaz VEVENT komponenst.');
        }

        if (! isset($vevent->DTSTART)) {
            throw new \InvalidArgumentException('A VEVENT-ből hiányzik a DTSTART.');
        }

        [$startsOn, $endsOn, $startTime, $endTime] = $this->readDates($vevent);

        $title = trim((string) ($vevent->SUMMARY ?? ''));

        return [
            'uid' => (string) ($vevent->UID ?? ''),
            'title' => $title !== '' ? mb_substr($title, 0, 200) : 'Névtelen bejegyzés',
            'starts_on' => $startsOn,
            'ends_on' => $endsOn,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'location' => $this->trimOrNull((string) ($vevent->LOCATION ?? ''), 200),
            'note' => $this->stripGeneratedDescription((string) ($vevent->DESCRIPTION ?? '')),
            'raw_ics' => $ics,
        ];
    }

    // --- Szerializálás ---------------------------------------------------

    private function document(): VCalendar
    {
        return new VCalendar([
            'PRODID' => self::PRODID,
            'VERSION' => '2.0',
            'CALSCALE' => 'GREGORIAN',
        ]);
    }

    private function addEvent(VCalendar $vcal, CalendarEvent $event): void
    {
        // Ha a bejegyzés a telefonról származik, az eredeti VEVENT-ből
        // indulunk, és csak az Octopus által kezelt mezőket írjuk felül —
        // így az ismétlődés, az emlékeztetők és a saját kiterjesztések
        // átvészelik a kört.
        $vevent = $this->reuseRawEvent($vcal, $event) ?? $vcal->add('VEVENT');

        $vevent->remove('SUMMARY');
        $vevent->remove('LOCATION');
        $vevent->remove('DESCRIPTION');
        $vevent->remove('UID');
        $vevent->remove('DTSTAMP');
        $vevent->remove('LAST-MODIFIED');
        $vevent->remove('CREATED');
        $vevent->remove('SEQUENCE');

        $vevent->add('UID', $event->uid);
        $vevent->add('SUMMARY', $event->title);

        $this->writeDates(
            $vcal,
            $vevent,
            CarbonImmutable::parse($event->starts_on),
            CarbonImmutable::parse($event->ends_on),
            $event->start_time,
            $event->end_time,
        );

        if ($event->location) {
            $vevent->add('LOCATION', $event->location);
        }

        $description = $this->composeDescription($event);
        if ($description !== null) {
            $vevent->add('DESCRIPTION', $description);
        }

        $vevent->add('DTSTAMP', new DateTimeImmutable('now', new DateTimeZone('UTC')));

        if ($event->updated_at) {
            $vevent->add('LAST-MODIFIED', $event->updated_at->clone()->setTimezone('UTC')->toDateTimeImmutable());
        }
        if ($event->created_at) {
            $vevent->add('CREATED', $event->created_at->clone()->setTimezone('UTC')->toDateTimeImmutable());
        }

        $vevent->remove('X-OCTOPUS-TYPE');
        $vevent->add('X-OCTOPUS-TYPE', $event->type);
    }

    private function addFeedItem(VCalendar $vcal, CalendarFeedItem $item): void
    {
        $vevent = $vcal->add('VEVENT');

        $vevent->add('UID', $item->uid);
        $vevent->add('SUMMARY', $item->summary);

        $this->writeDates($vcal, $vevent, $item->startsOn, $item->endsOn, null, null);

        if ($item->location) {
            $vevent->add('LOCATION', $item->location);
        }
        if ($item->description) {
            $vevent->add('DESCRIPTION', $item->description);
        }

        // A határidő-jellegű elemek ne tegyék „foglalttá” a napot a
        // szabad/foglalt nézetben — egy leadási határidő nem elfoglaltság.
        $vevent->add('TRANSP', $item->transparent ? 'TRANSPARENT' : 'OPAQUE');
        $vevent->add('X-OCTOPUS-KIND', $item->kind);
        $vevent->add('DTSTAMP', new DateTimeImmutable('now', new DateTimeZone('UTC')));

        if ($item->modifiedAt) {
            $vevent->add('LAST-MODIFIED', (new DateTimeImmutable('@'.$item->modifiedAt->getTimestamp()))->setTimezone(new DateTimeZone('UTC')));
        }
    }

    /**
     * A telefonról kapott eredeti VEVENT újrahasznosítása, ha van.
     */
    private function reuseRawEvent(VCalendar $vcal, CalendarEvent $event): ?VEvent
    {
        if (! $event->raw_ics) {
            return null;
        }

        try {
            $source = Reader::read($event->raw_ics, Reader::OPTION_FORGIVING);
        } catch (\Throwable) {
            return null;
        }

        $sourceEvent = $source->VEVENT ?? null;
        if ($sourceEvent instanceof Node && ! $sourceEvent instanceof VEvent) {
            $sourceEvent = $sourceEvent[0] ?? null;
        }

        if (! $sourceEvent instanceof VEvent) {
            return null;
        }

        $copy = $vcal->add('VEVENT');
        foreach ($sourceEvent->children() as $child) {
            $copy->add(clone $child);
        }

        // A dátumokat mindig az Octopus adatai határozzák meg.
        $copy->remove('DTSTART');
        $copy->remove('DTEND');
        $copy->remove('DURATION');

        return $copy;
    }

    /**
     * DTSTART/DTEND kiírása. Idő nélkül egész napos (DATE) esemény, ahol a
     * DTEND a szabvány szerint kizárólagos — ezért ends_on + 1 nap.
     */
    private function writeDates(
        VCalendar $vcal,
        VEvent $vevent,
        CarbonImmutable $startsOn,
        CarbonImmutable $endsOn,
        ?string $startTime,
        ?string $endTime,
    ): void {
        $vevent->remove('DTSTART');
        $vevent->remove('DTEND');
        $vevent->remove('DURATION');

        $tz = new DateTimeZone(self::TIMEZONE);

        if ($startTime === null) {
            $dtstart = $vcal->createProperty('DTSTART', null, ['VALUE' => 'DATE']);
            $dtstart->setDateTime($startsOn->startOfDay()->toDateTimeImmutable());

            $dtend = $vcal->createProperty('DTEND', null, ['VALUE' => 'DATE']);
            $dtend->setDateTime($endsOn->addDay()->startOfDay()->toDateTimeImmutable());

            $vevent->add($dtstart);
            $vevent->add($dtend);

            return;
        }

        $this->ensureTimezone($vcal);

        $start = new DateTimeImmutable($startsOn->toDateString().' '.$startTime, $tz);

        // Záró időpont nélkül egy órát feltételezünk — a telefon nem tud mit
        // kezdeni a nyitott végű eseménnyel.
        $end = new DateTimeImmutable(
            $endsOn->toDateString().' '.($endTime ?? $startTime),
            $tz,
        );

        if ($endTime === null) {
            $end = $end->modify('+1 hour');
        }

        if ($end <= $start) {
            $end = $start->modify('+1 hour');
        }

        $dtstart = $vcal->createProperty('DTSTART');
        $dtstart->setDateTime($start);

        $dtend = $vcal->createProperty('DTEND');
        $dtend->setDateTime($end);

        $vevent->add($dtstart);
        $vevent->add($dtend);
    }

    /**
     * VTIMEZONE komponens — enélkül egyes kliensek nem tudják feloldani a
     * TZID-t, és rossz órára teszik az eseményt.
     */
    private function ensureTimezone(VCalendar $vcal): void
    {
        if (isset($vcal->VTIMEZONE)) {
            return;
        }

        $vtz = $vcal->add('VTIMEZONE');
        $vtz->add('TZID', self::TIMEZONE);

        // A DAYLIGHT/STANDARD alkomponenst kézzel kell létrehozni: a vobject
        // komponens-térképe nem ismeri őket, ezért az add('DAYLIGHT') sima
        // tulajdonságot gyártana, nem beágyazott komponenst.
        $vtz->add($vcal->createComponent('DAYLIGHT', [
            'TZOFFSETFROM' => '+0100',
            'TZOFFSETTO' => '+0200',
            'TZNAME' => 'CEST',
            'DTSTART' => '19700329T020000',
            'RRULE' => 'FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
        ], defaults: false));

        $vtz->add($vcal->createComponent('STANDARD', [
            'TZOFFSETFROM' => '+0200',
            'TZOFFSETTO' => '+0100',
            'TZNAME' => 'CET',
            'DTSTART' => '19701025T030000',
            'RRULE' => 'FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
        ], defaults: false));
    }

    /**
     * A jegyzet mellé a projekt és a résztvevők — a telefonon ebből derül ki,
     * melyik munkáról van szó. A generált részt elválasztjuk, hogy a
     * visszaszinkronizálásnál le tudjuk vágni.
     */
    private function composeDescription(CalendarEvent $event): ?string
    {
        $extra = [];

        if ($project = $event->project) {
            $extra[] = 'Projekt: '.trim($project->code.' – '.$project->name);
        }

        if ($event->assignees->isNotEmpty()) {
            $extra[] = 'Résztvevők: '.$event->assignees->pluck('name')->implode(', ');
        }

        $note = trim((string) $event->note);

        if ($extra === []) {
            return $note !== '' ? $note : null;
        }

        return ($note !== '' ? $note."\n" : '').self::DESCRIPTION_MARKER.implode("\n", $extra);
    }

    // --- Olvasás ---------------------------------------------------------

    /**
     * @return array{0: string, 1: string, 2: ?string, 3: ?string}
     */
    private function readDates(VEvent $vevent): array
    {
        $tz = new DateTimeZone(self::TIMEZONE);

        /** @var DateTime $dtstartProp */
        $dtstartProp = $vevent->DTSTART;
        $allDay = ! $dtstartProp->hasTime();

        $start = $dtstartProp->getDateTime($tz);

        if (isset($vevent->DTEND)) {
            $end = $vevent->DTEND->getDateTime($tz);
        } elseif (isset($vevent->DURATION)) {
            $end = $start->add(DateTimeParser::parseDuration((string) $vevent->DURATION));
        } else {
            $end = $allDay ? $start->modify('+1 day') : $start->modify('+1 hour');
        }

        if ($allDay) {
            // A DTEND kizárólagos: az utolsó tartalmazott nap eggyel kevesebb.
            $lastDay = CarbonImmutable::instance($end)->subDay();
            $firstDay = CarbonImmutable::instance($start);

            return [
                $firstDay->toDateString(),
                $lastDay->lt($firstDay) ? $firstDay->toDateString() : $lastDay->toDateString(),
                null,
                null,
            ];
        }

        $start = CarbonImmutable::instance($start)->setTimezone($tz);
        $end = CarbonImmutable::instance($end)->setTimezone($tz);

        if ($end->lte($start)) {
            $end = $start->addHour();
        }

        return [
            $start->toDateString(),
            $end->toDateString(),
            $start->format('H:i:s'),
            $end->format('H:i:s'),
        ];
    }

    /**
     * A kiadáskor hozzáfűzött projekt/résztvevő blokk levágása, hogy az ne
     * épüljön bele a felhasználó jegyzetébe minden szinkron-körben.
     */
    private function stripGeneratedDescription(string $description): ?string
    {
        $marker = trim(self::DESCRIPTION_MARKER);
        $position = mb_strpos($description, $marker);

        if ($position !== false) {
            $description = mb_substr($description, 0, $position);
        }

        return $this->trimOrNull($description);
    }

    private function trimOrNull(string $value, ?int $limit = null): ?string
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        return $limit ? mb_substr($value, 0, $limit) : $value;
    }
}
