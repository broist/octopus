<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\MachineBooking;
use App\Models\MaterialProcurement;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\StaffAbsence;
use App\Models\Task;
use App\Models\User;
use App\Support\CalendarCollections;
use App\Support\Materials;
use App\Support\Staff;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * A telefonra kiadott naptárak tartalmát állítja össze.
 *
 * A szerkeszthető kollekciók a calendar_events táblát adják vissza, a
 * határidő-naptár pedig hat modul csak-olvasható adatait normalizálja
 * CalendarFeedItem-mé.
 */
class CalendarFeed
{
    /**
     * Kiadási ablak: a telefonnak nincs értelme évekre visszamenő
     * határidőket tárolnia, a végtelen tartomány viszont minden szinkronnál
     * fölösleges terhelés lenne.
     */
    private const MONTHS_BACK = 6;

    private const MONTHS_AHEAD = 24;

    /**
     * A telefonon megjelenő naptárak leírói: három rögzített, plusz
     * projektenként egy. A CalDAV-backend és a Profil oldal is ebből dolgozik.
     *
     * @return Collection<int, array{key: string, name: string, description: string, color: string, writable: bool, creatable: bool}>
     */
    public function collections(User $user): Collection
    {
        $fixed = collect(CalendarCollections::FIXED)
            ->map(fn (array $meta, string $key) => ['key' => $key, ...$meta])
            ->values();

        $projects = $this->activeProjects()->map(fn (Project $project) => [
            'key' => CalendarCollections::projectKey($project->id),
            // A fiók neve a telefonon már „Octopus”, ezért itt a projekt
            // azonosítója a hasznos információ, nem az ismételt márkanév.
            'name' => trim($project->code.' · '.$project->name),
            'description' => 'A csapat is látja. Ide mentve a bejegyzés ehhez a projekthez rendelődik.',
            'color' => CalendarCollections::projectColor($project->id),
            'writable' => true,
            'creatable' => true,
        ]);

        return $fixed->concat($projects)->values();
    }

    /**
     * A telefonon megjelenő projektek: minden, ami nincs lezárva.
     *
     * @return Collection<int, Project>
     */
    public function activeProjects(): Collection
    {
        return Project::query()
            ->where('status', '!=', 'lezart')
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'status']);
    }

    /**
     * A saját, privát bejegyzéseid — projekttől függetlenül MIND ide tartozik.
     *
     * A felosztás elve: ami privát, az mindig a Személyes naptárban van, ami
     * közös, az a projekt naptárában vagy a Munkanaptárban. Így a telefonon a
     * naptár neve egyértelműen megmondja, ki látja a bejegyzést — és egy
     * bejegyzés pontosan egy naptárban szerepel, nem duplázódik.
     */
    public function personalEvents(User $user): Collection
    {
        return CalendarEvent::query()
            ->where('type', 'szemelyes')
            ->where('created_by', $user->id)
            ->whereBetween('starts_on', $this->window())
            ->with(['project:id,code,name', 'assignees:id,name'])
            ->get();
    }

    /**
     * Munkanaptár: a rám beosztott, projekthez nem kötött munkák, plusz a
     * mindenkit érintő (résztvevő nélküli) céges események.
     */
    public function workEvents(User $user): Collection
    {
        return CalendarEvent::query()
            ->whereIn('type', ['beosztas', 'szallitas', 'esemeny'])
            ->whereNull('project_id')
            ->whereBetween('starts_on', $this->window())
            ->where(fn ($q) => $this->scopeToUser($q, $user))
            ->with(['project:id,code,name', 'assignees:id,name'])
            ->get();
    }

    /**
     * Egy projekt naptára: a projekt KÖZÖS bejegyzései, amik rád tartoznak.
     *
     * Privát bejegyzés ide sosem kerül — az a Személyesben marad, akkor is,
     * ha projekthez van kötve. Így a projekt naptárában látott bejegyzésről
     * biztosan tudod, hogy a csapat is látja.
     */
    public function projectEvents(User $user, int $projectId): Collection
    {
        return CalendarEvent::query()
            ->where('project_id', $projectId)
            ->whereIn('type', ['beosztas', 'szallitas', 'esemeny'])
            ->whereBetween('starts_on', $this->window())
            ->where(fn ($q) => $this->scopeToUser($q, $user))
            ->with(['project:id,code,name', 'assignees:id,name'])
            ->get();
    }

    /**
     * Rám tartozik-e: be vagyok osztva, vagy mindenkinek szól.
     */
    private function scopeToUser($query, User $user)
    {
        return $query
            ->whereHas('assignees', fn ($a) => $a->where('users.id', $user->id))
            ->orWhereDoesntHave('assignees');
    }

    /**
     * Határidő-naptár: fázis-mérföldkövek, projekt-átadások, a saját
     * feladataim, anyagszállítások, gépfoglalások és a saját szabadságom.
     *
     * @return Collection<int, CalendarFeedItem>
     */
    public function deadlineItems(User $user): Collection
    {
        [$from, $to] = $this->window();

        return collect()
            ->concat($this->phaseItems($from, $to))
            ->concat($this->projectItems($from, $to))
            ->concat($this->taskItems($user, $from, $to))
            ->concat($this->deliveryItems($from, $to))
            ->concat($this->machineItems($from, $to))
            ->concat($this->absenceItems($user, $from, $to))
            ->values();
    }

    /** @return Collection<int, CalendarFeedItem> */
    private function phaseItems(string $from, string $to): Collection
    {
        return ProjectPhase::query()
            ->work()
            ->whereNotNull('due_on')
            ->whereBetween('due_on', [$from, $to])
            ->with('project:id,code,name')
            ->get()
            ->map(fn (ProjectPhase $phase) => new CalendarFeedItem(
                uid: "fazis-{$phase->id}@octopus",
                summary: ($phase->progress >= 100 ? '✓ ' : '').$phase->name,
                startsOn: CarbonImmutable::parse($phase->due_on),
                endsOn: CarbonImmutable::parse($phase->due_on),
                description: $this->describeProject($phase->project, 'Fázis határideje'),
                modifiedAt: $phase->updated_at,
                kind: 'fazis',
            ));
    }

    /** @return Collection<int, CalendarFeedItem> */
    private function projectItems(string $from, string $to): Collection
    {
        return Project::query()
            ->whereNotNull('ends_on')
            ->whereBetween('ends_on', [$from, $to])
            ->get(['id', 'code', 'name', 'ends_on', 'status', 'updated_at'])
            ->map(fn (Project $project) => new CalendarFeedItem(
                uid: "atadas-{$project->id}@octopus",
                summary: 'Tervezett befejezés – '.$project->code,
                startsOn: CarbonImmutable::parse($project->ends_on),
                endsOn: CarbonImmutable::parse($project->ends_on),
                description: $this->describeProject($project, 'Projekt tervezett befejezése'),
                modifiedAt: $project->updated_at,
                kind: 'atadas',
            ));
    }

    /** @return Collection<int, CalendarFeedItem> */
    private function taskItems(User $user, string $from, string $to): Collection
    {
        return Task::query()
            ->whereNotNull('due_on')
            ->whereBetween('due_on', [$from, $to])
            ->whereHas('assignees', fn ($a) => $a->where('users.id', $user->id))
            ->with('project:id,code,name')
            ->get()
            ->map(fn (Task $task) => new CalendarFeedItem(
                uid: "feladat-{$task->id}@octopus",
                summary: ($task->status === 'kesz' ? '✓ ' : '').$task->title,
                startsOn: CarbonImmutable::parse($task->due_on),
                endsOn: CarbonImmutable::parse($task->due_on),
                description: $this->describeProject($task->project, 'Feladat határideje'),
                modifiedAt: $task->updated_at,
                kind: 'feladat',
            ));
    }

    /** @return Collection<int, CalendarFeedItem> */
    private function deliveryItems(string $from, string $to): Collection
    {
        return MaterialProcurement::query()
            ->deliveringBetween($from, $to)
            ->with(['material:id,name,unit', 'project:id,code,name'])
            ->get()
            ->map(function (MaterialProcurement $procurement) {
                $date = $procurement->received_on ?? $procurement->expected_on;

                if ($date === null) {
                    return null;
                }

                $unit = $procurement->material
                    ? (Materials::UNITS[$procurement->material->unit] ?? $procurement->material->unit)
                    : '';

                $quantity = rtrim(rtrim(number_format((float) $procurement->quantity, 2, ',', ' '), '0'), ',');

                return new CalendarFeedItem(
                    uid: "szallitas-{$procurement->id}@octopus",
                    summary: trim(($procurement->received_on ? '✓ ' : '').
                        ($procurement->material?->name ?? 'Anyagszállítás').' '.$quantity.' '.$unit),
                    startsOn: CarbonImmutable::parse($date),
                    endsOn: CarbonImmutable::parse($date),
                    description: $this->describeProject(
                        $procurement->project,
                        $procurement->received_on ? 'Beérkezett anyag' : 'Várható anyagszállítás',
                    ),
                    modifiedAt: $procurement->updated_at,
                    kind: 'szallitas',
                );
            })
            ->filter()
            ->values();
    }

    /** @return Collection<int, CalendarFeedItem> */
    private function machineItems(string $from, string $to): Collection
    {
        return MachineBooking::query()
            ->overlapping($from, $to)
            ->with(['machine:id,name', 'project:id,code,name'])
            ->get()
            ->map(fn (MachineBooking $booking) => new CalendarFeedItem(
                uid: "gepfoglalas-{$booking->id}@octopus",
                summary: 'Gép: '.($booking->machine?->name ?? 'ismeretlen'),
                startsOn: CarbonImmutable::parse($booking->starts_on),
                endsOn: CarbonImmutable::parse($booking->ends_on),
                description: $this->describeProject($booking->project, 'Gépfoglalás'),
                modifiedAt: $booking->updated_at,
                kind: 'gepfoglalas',
            ));
    }

    /** @return Collection<int, CalendarFeedItem> */
    private function absenceItems(User $user, string $from, string $to): Collection
    {
        return StaffAbsence::query()
            ->overlapping($from, $to)
            ->where('user_id', $user->id)
            ->get()
            ->map(fn (StaffAbsence $absence) => new CalendarFeedItem(
                uid: "tavollet-{$absence->id}@octopus",
                summary: Staff::ABSENCE_TYPES[$absence->type] ?? $absence->type,
                startsOn: CarbonImmutable::parse($absence->starts_on),
                endsOn: CarbonImmutable::parse($absence->ends_on),
                description: $absence->note ?: null,
                modifiedAt: $absence->updated_at,
                kind: 'tavollet',
                // A szabadság valódi elfoglaltság, ne látszódjon szabadnak.
                transparent: false,
            ));
    }

    private function describeProject(?Project $project, string $prefix): string
    {
        if (! $project) {
            return $prefix;
        }

        return $prefix.' – '.trim($project->code.' '.$project->name);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function window(): array
    {
        $today = CarbonImmutable::today();

        return [
            $today->subMonths(self::MONTHS_BACK)->toDateString(),
            $today->addMonths(self::MONTHS_AHEAD)->toDateString(),
        ];
    }
}
