<?php

namespace App\Caldav;

use App\Models\CalendarEvent;
use App\Models\User;
use App\Services\CalendarFeed;
use App\Services\CalendarFeedItem;
use App\Services\CalendarIcs;
use App\Support\CalendarCollections;
use Illuminate\Support\Collection;
use Sabre\CalDAV\Backend\AbstractBackend;
use Sabre\CalDAV\Xml\Property\SupportedCalendarComponentSet;
use Sabre\DAV\Exception\Conflict;
use Sabre\DAV\Exception\Forbidden;
use Sabre\DAV\Exception\NotFound;
use Sabre\DAV\PropPatch;

/**
 * Az Octopus naptárai CalDAV-on keresztül.
 *
 * A naptár azonosítója [felhasználó azonosító, kollekció kulcs] pár — a sabre
 * backend-metódusainak egy része nem kapja meg a principalt, ezért a
 * felhasználót magában az azonosítóban visszük.
 */
class CalendarBackend extends AbstractBackend
{
    /**
     * Kérésen belüli gyorsítótár: egy szinkron-kör alatt ugyanazt a
     * kollekciót többször is bejárja a sabre (ctag, listázás, multiget).
     *
     * @var array<string, Collection<string, array<string, mixed>>>
     */
    private array $cache = [];

    public function __construct(
        private readonly CalendarFeed $feed,
        private readonly CalendarIcs $ics,
    ) {}

    public function getCalendarsForUser($principalUri): array
    {
        $user = $this->userFromPrincipal($principalUri);

        // Naptár-hozzáférés nélkül nincs mit kiadni — a naptár-jelszó nem ad
        // több jogot, mint amennyi a felhasználónak a felületen van.
        if (! $user || ! $user->can('scheduling.view')) {
            return [];
        }

        return $this->feed->collections($user)
            ->map(fn (array $meta) => [
                'id' => [$user->id, $meta['key']],
                'uri' => $meta['key'],
                'principaluri' => $principalUri,
                '{DAV:}displayname' => $meta['name'],
                '{urn:ietf:params:xml:ns:caldav}calendar-description' => $meta['description'],
                '{urn:ietf:params:xml:ns:caldav}calendar-timezone' => null,
                '{urn:ietf:params:xml:ns:caldav}supported-calendar-component-set' => new SupportedCalendarComponentSet(['VEVENT']),
                '{http://apple.com/ns/ical/}calendar-color' => $meta['color'],
                '{http://calendarserver.org/ns/}getctag' => $this->ctag([$user->id, $meta['key']]),
                // A sabre ebből építi az ACL-t: a telefon így már a felületen
                // sem kínálja fel a szerkesztést, nem csak hibára fut.
                '{http://sabredav.org/ns}read-only' => ! $meta['writable'],
            ])
            ->all();
    }

    public function createCalendar($principalUri, $calendarUri, array $properties): void
    {
        throw new Forbidden('Az Octopus naptárai fixek, új naptár nem hozható létre.');
    }

    public function updateCalendar($calendarId, PropPatch $propPatch): void
    {
        // A naptár nevét és színét az Octopus határozza meg — a telefonon
        // végzett átnevezés a következő szinkronnál úgyis visszaállna.
    }

    public function deleteCalendar($calendarId): void
    {
        throw new Forbidden('Az Octopus naptárai nem törölhetők a telefonról.');
    }

    public function getCalendarObjects($calendarId): array
    {
        return $this->objects($calendarId)
            ->map(fn (array $row) => [
                'id' => $row['uri'],
                'uri' => $row['uri'],
                'etag' => $row['etag'],
                'lastmodified' => $row['lastmodified'],
                'calendarid' => $calendarId,
                'component' => 'vevent',
            ])
            ->values()
            ->all();
    }

    public function getCalendarObject($calendarId, $objectUri): ?array
    {
        $row = $this->objects($calendarId)->get($objectUri);

        if ($row === null) {
            return null;
        }

        $data = $this->serialize($row['payload']);

        return [
            'id' => $row['uri'],
            'uri' => $row['uri'],
            'etag' => $row['etag'],
            'lastmodified' => $row['lastmodified'],
            'calendarid' => $calendarId,
            'component' => 'vevent',
            'size' => strlen($data),
            'calendardata' => $data,
        ];
    }

    /**
     * A kliens az első szinkronnál egyetlen multiget-tel kéri az összes
     * objektumot — ezért a sabre alapértelmezett, darabonkénti lekérdezése
     * helyett a már betöltött kollekcióból szolgálunk ki.
     */
    public function getMultipleCalendarObjects($calendarId, array $uris): array
    {
        $objects = $this->objects($calendarId);
        $result = [];

        foreach ($uris as $uri) {
            $row = $objects->get($uri);

            if ($row === null) {
                continue;
            }

            $data = $this->serialize($row['payload']);

            $result[] = [
                'id' => $row['uri'],
                'uri' => $row['uri'],
                'etag' => $row['etag'],
                'lastmodified' => $row['lastmodified'],
                'calendarid' => $calendarId,
                'component' => 'vevent',
                'size' => strlen($data),
                'calendardata' => $data,
            ];
        }

        return $result;
    }

    public function createCalendarObject($calendarId, $objectUri, $calendarData): string
    {
        [$userId, $collection] = $this->split($calendarId);

        $user = $this->user($userId);
        $attributes = $this->parse($calendarData);
        $projectId = CalendarCollections::projectId($collection);

        // Naptárak közti mozgatásnál a telefon nem MOVE-ot küld, hanem az új
        // naptárba PUT-ot és a régiből DELETE-et — tetszőleges sorrendben.
        // Ha tehát már létezik ilyen bejegyzés, ez áthelyezés, nem ütközés.
        $existing = $this->findByObjectName($attributes['uid'] ?: null, $objectUri);

        // Az „új bejegyzés nem vehető fel” szabály csak a VALÓBAN újakra
        // vonatkozik: egy meglévő beosztás áthelyezése a munkanaptárba
        // (vagyis kivétele a projektből) attól még megengedett.
        if ($existing === null && ! CalendarCollections::allowsCreate($collection)) {
            throw new Forbidden(
                CalendarCollections::name($collection).': ebbe a naptárba a telefonról nem vehető fel új bejegyzés.'
            );
        }

        if ($existing !== null) {
            if (! CalendarCollections::isWritable($collection)) {
                throw new Forbidden(
                    CalendarCollections::name($collection).': ez a naptár csak olvasható.'
                );
            }

            if (! $existing->canBeManagedBy($user)) {
                throw new Conflict('Ezzel az azonosítóval már létezik naptárbejegyzés.');
            }

            unset($attributes['uid']);
            $existing->fill($attributes);
            $existing->type = $this->resolveType($collection, $user, $existing);
            $existing->project_id = $projectId;
            $existing->caldav_uri = $objectUri;
            $existing->save();

            $this->forget($calendarId);

            return $existing->fresh()->etag();
        }

        $event = CalendarEvent::create([
            ...$attributes,
            'uid' => $attributes['uid'] ?: null,
            'type' => $this->resolveType($collection, $user, null),
            'project_id' => $projectId,
            'caldav_uri' => $objectUri,
            'created_by' => $user->id,
        ]);

        $this->forget($calendarId);

        return $event->etag();
    }

    /**
     * A cél-naptár dönti el, hogy a bejegyzés privát-e vagy közös.
     *
     * A telefon naptárában nincs „láthatóság” kapcsoló, ezért ezt a naptár
     * választása hordozza: a Személyes csak a sajátod, a projekt- és a
     * munkanaptár tartalmát a csapat is látja. Az áthelyezés így értelmes
     * művelet: privátból projektbe tenni annyi, mint megosztani.
     */
    private function resolveType(string $collection, User $user, ?CalendarEvent $existing): string
    {
        if ($collection === CalendarCollections::PERSONAL) {
            // A beosztás és a szállítás modul-adat: ha priváttá tennénk,
            // eltűnne azok elől, akikre tartozik.
            if ($existing !== null && in_array($existing->type, ['beosztas', 'szallitas'], true)) {
                throw new Forbidden(
                    'A beosztás és az anyagszállítás nem tehető személyes bejegyzéssé. Ezt az Octopusban tudod átállítani.'
                );
            }

            return 'szemelyes';
        }

        // Közös naptár. A már közös típusokat megtartjuk (egy beosztás
        // maradjon beosztás), a privátból viszont esemény lesz.
        if ($existing !== null && $existing->type !== 'szemelyes') {
            return $existing->type;
        }

        if (! $user->can('scheduling.create')) {
            throw new Forbidden(
                'Közös bejegyzés létrehozásához nincs jogosultságod. A saját bejegyzéseidet az „Octopus – Személyes” naptárba vedd fel.'
            );
        }

        return 'esemeny';
    }

    public function updateCalendarObject($calendarId, $objectUri, $calendarData): string
    {
        $event = $this->writableEvent($calendarId, $objectUri);

        $attributes = $this->parse($calendarData);

        // A UID és a típus az Octopusé — a telefon a tartalmat módosíthatja,
        // a bejegyzés azonosságát és besorolását nem.
        unset($attributes['uid']);

        $event->fill($attributes);
        $event->caldav_uri = $objectUri;
        $event->save();

        $this->forget($calendarId);

        return $event->fresh()->etag();
    }

    /**
     * Naptárak közti áthelyezésnél a telefon a régi naptárból is töröl. Ha a
     * bejegyzés már átkerült, a sabre 404-gyel válaszol, mielőtt ide jutnánk —
     * ez a helyes végállapot (az adott naptárban tényleg nincs ott), és a
     * kliensek így is értelmezik. Az áthelyezés maga a createCalendarObject
     * felismerésén múlik, nem ezen.
     */
    public function deleteCalendarObject($calendarId, $objectUri): void
    {
        $event = $this->writableEvent($calendarId, $objectUri);

        $event->assignees()->detach();
        $event->delete();

        $this->forget($calendarId);
    }

    // --- Belső segédek ---------------------------------------------------

    /**
     * A módosítható bejegyzés kikeresése és jogosultság-ellenőrzés.
     */
    private function writableEvent($calendarId, string $objectUri): CalendarEvent
    {
        [$userId, $collection] = $this->split($calendarId);

        if (! CalendarCollections::isWritable($collection)) {
            throw new Forbidden(
                CalendarCollections::name($collection).': ez a naptár csak olvasható, a tartalmát a forrásmodulban lehet módosítani.'
            );
        }

        $row = $this->objects($calendarId)->get($objectUri);

        if ($row === null || ! $row['payload'] instanceof CalendarEvent) {
            throw new NotFound('A naptárbejegyzés nem található.');
        }

        /** @var CalendarEvent $event */
        $event = $row['payload'];

        // Ugyanaz a szabály, mint a felületen: a személyes bejegyzés a
        // gazdájáé, a beosztást csak megfelelő joggal lehet átírni.
        if (! $event->canBeManagedBy($this->user($userId))) {
            throw new Forbidden('Ehhez a bejegyzéshez nincs szerkesztési jogod.');
        }

        return $event;
    }

    /**
     * Bejegyzés keresése a CalDAV-azonosítói alapján, naptártól függetlenül.
     *
     * A telefonon készült bejegyzést a kliens által választott fájlnév, az
     * Octopusban készültet a UID azonosítja.
     */
    private function findByObjectName(?string $uid, string $objectUri): ?CalendarEvent
    {
        return CalendarEvent::query()
            ->where(function ($q) use ($uid, $objectUri) {
                $q->where('caldav_uri', $objectUri);

                if ($uid !== null && $uid !== '') {
                    $q->orWhere('uid', $uid);
                }
            })
            ->first();
    }

    /**
     * A kollekció tartalma fájlnév szerint indexelve.
     *
     * @return Collection<string, array{uri: string, etag: string, lastmodified: int, payload: CalendarEvent|CalendarFeedItem}>
     */
    private function objects($calendarId): Collection
    {
        [$userId, $collection] = $this->split($calendarId);
        $cacheKey = $userId.'|'.$collection;

        if (isset($this->cache[$cacheKey])) {
            return $this->cache[$cacheKey];
        }

        $user = $this->user($userId);

        $projectId = CalendarCollections::projectId($collection);

        $rows = match (true) {
            $collection === CalendarCollections::PERSONAL => $this->fromEvents($this->feed->personalEvents($user)),
            $collection === CalendarCollections::WORK => $this->fromEvents($this->feed->workEvents($user)),
            $collection === CalendarCollections::DEADLINES => $this->fromFeedItems($this->feed->deadlineItems($user)),
            $projectId !== null => $this->fromEvents($this->feed->projectEvents($user, $projectId)),
            default => collect(),
        };

        return $this->cache[$cacheKey] = $rows;
    }

    private function fromEvents(Collection $events): Collection
    {
        return $events->keyBy(fn (CalendarEvent $event) => $event->calendarObjectName())
            ->map(fn (CalendarEvent $event) => [
                'uri' => $event->calendarObjectName(),
                'etag' => $event->etag(),
                'lastmodified' => $event->updated_at?->getTimestamp() ?? 0,
                'payload' => $event,
            ]);
    }

    private function fromFeedItems(Collection $items): Collection
    {
        return $items->keyBy(fn (CalendarFeedItem $item) => $item->objectName())
            ->map(fn (CalendarFeedItem $item) => [
                'uri' => $item->objectName(),
                'etag' => $item->etag(),
                'lastmodified' => $item->modifiedAt?->getTimestamp() ?? 0,
                'payload' => $item,
            ]);
    }

    private function serialize(CalendarEvent|CalendarFeedItem $payload): string
    {
        return $payload instanceof CalendarEvent
            ? $this->ics->fromEvent($payload)
            : $this->ics->fromFeedItem($payload);
    }

    /**
     * @return array<string, mixed>
     */
    private function parse($calendarData): array
    {
        try {
            return $this->ics->toAttributes(is_resource($calendarData)
                ? (string) stream_get_contents($calendarData)
                : (string) $calendarData);
        } catch (\InvalidArgumentException $e) {
            throw new Conflict($e->getMessage(), previous: $e);
        }
    }

    /**
     * A kollekció változás-jelzője: ha ez módosul, a kliens újraszinkronizál.
     *
     * A tartalomból származtatjuk, nem külön számlálóból — így nem tud
     * elcsúszni akkor sem, ha egy bejegyzés más modulon keresztül változik.
     */
    private function ctag($calendarId): string
    {
        $rows = $this->objects($calendarId);

        return md5($rows->map(fn (array $row) => $row['uri'].$row['etag'])->implode('|'));
    }

    private function forget($calendarId): void
    {
        [$userId, $collection] = $this->split($calendarId);
        unset($this->cache[$userId.'|'.$collection]);
    }

    /**
     * @return array{0: int, 1: string}
     */
    private function split($calendarId): array
    {
        if (! is_array($calendarId) || count($calendarId) !== 2) {
            throw new NotFound('Ismeretlen naptár.');
        }

        return [(int) $calendarId[0], (string) $calendarId[1]];
    }

    private function user(int $userId): User
    {
        $user = CalendarContext::user();

        if (! $user || $user->id !== $userId) {
            throw new Forbidden('Csak a saját naptárad érhető el.');
        }

        return $user;
    }

    private function userFromPrincipal(string $principalUri): ?User
    {
        $email = basename($principalUri);
        $user = CalendarContext::user();

        return $user && $user->email === $email ? $user : null;
    }
}
