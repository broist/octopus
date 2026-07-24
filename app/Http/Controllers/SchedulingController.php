<?php

namespace App\Http\Controllers;

use App\Http\Requests\CalendarEventRequest;
use App\Models\CalendarEvent;
use App\Models\MachineBooking;
use App\Models\MaterialProcurement;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\StaffAbsence;
use App\Models\Task;
use App\Models\User;
use App\Support\Materials;
use App\Support\Staff;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SchedulingController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $view = in_array($request->string('view')->toString(), ['month', 'week', 'day'], true)
            ? $request->string('view')->toString()
            : 'month';

        try {
            $date = CarbonImmutable::parse($request->string('date', 'now')->toString());
        } catch (\Throwable) {
            $date = CarbonImmutable::now();
        }

        [$rangeStart, $rangeEnd] = match ($view) {
            'day' => [$date, $date],
            'week' => [$date->startOfWeek(), $date->endOfWeek()],
            default => [
                $date->startOfMonth()->startOfWeek(),
                $date->endOfMonth()->endOfWeek(),
            ],
        };

        $personFilter = $request->integer('person');
        $typeFilter = $request->string('type')->toString();

        // --- Események a tartományban ---
        $events = CalendarEvent::query()
            ->visibleTo($user)
            ->whereDate('starts_on', '<=', $rangeEnd)
            ->whereDate('ends_on', '>=', $rangeStart)
            ->when($personFilter > 0, fn ($q) => $q->whereHas(
                'assignees', fn ($a) => $a->where('users.id', $personFilter)
            ))
            ->when($typeFilter !== '', fn ($q) => $q->where('type', $typeFilter))
            ->with(['project:id,code,name', 'assignees:id,name', 'creator:id,name'])
            ->orderBy('starts_on')->orderBy('start_time')->orderBy('id')
            ->get();

        // --- Ütközés-jelzés: ugyanaz a személy több beosztásban ugyanazon a napon ---
        $conflicted = $this->conflictedEventIds($events);

        // --- Mérföldkövek / határidők a projektekből (csak olvasható réteg) ---
        $milestones = ProjectPhase::query()
            ->whereNotNull('due_on')
            ->whereBetween('due_on', [$rangeStart->toDateString(), $rangeEnd->toDateString()])
            ->with('project:id,code,name')
            ->get()
            ->map(fn (ProjectPhase $ph) => [
                'key' => "fazis-{$ph->id}",
                'date' => $ph->due_on->toDateString(),
                'label' => $ph->name,
                'kind' => 'fazis',
                'done' => $ph->progress >= 100,
                'project' => $ph->project
                    ? ['id' => $ph->project->id, 'code' => $ph->project->code, 'name' => $ph->project->name]
                    : null,
            ])
            ->concat(
                Project::query()
                    ->whereNotNull('ends_on')
                    ->whereBetween('ends_on', [$rangeStart->toDateString(), $rangeEnd->toDateString()])
                    ->get(['id', 'code', 'name', 'ends_on', 'status'])
                    ->map(fn (Project $p) => [
                        'key' => "atadas-{$p->id}",
                        'date' => $p->ends_on->toDateString(),
                        'label' => 'Tervezett befejezés',
                        'kind' => 'atadas',
                        'done' => $p->status === 'lezart',
                        'project' => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name],
                    ])
            )
            ->values();

        // --- Feladat-határidők (spec §13: a határidős feladatok a naptárban) ---
        $taskItems = Task::query()
            ->whereNotNull('due_on')
            ->whereBetween('due_on', [$rangeStart->toDateString(), $rangeEnd->toDateString()])
            ->when($personFilter > 0, fn ($q) => $q->whereHas(
                'assignees', fn ($a) => $a->where('users.id', $personFilter)
            ))
            ->with('project:id,code,name')
            ->get()
            ->map(fn (Task $t) => [
                'key' => "feladat-{$t->id}",
                'id' => $t->id,
                'date' => $t->due_on->toDateString(),
                'label' => $t->title,
                'done' => $t->status === 'kesz',
                'overdue' => $t->isOverdue(),
                'project' => $t->project
                    ? ['id' => $t->project->id, 'code' => $t->project->code, 'name' => $t->project->name]
                    : null,
            ])
            ->values();

        // --- Szabadság / távollét (6. modul, csak olvasható réteg) ---
        $absences = StaffAbsence::query()
            ->overlapping($rangeStart->toDateString(), $rangeEnd->toDateString())
            ->when($personFilter > 0, fn ($q) => $q->where('user_id', $personFilter))
            ->with('user:id,name')
            ->get()
            ->map(fn (StaffAbsence $a) => [
                'key' => "tavollet-{$a->id}",
                'user_id' => $a->user_id,
                'user_name' => $a->user?->name,
                'type' => $a->type,
                'type_label' => Staff::ABSENCE_TYPES[$a->type] ?? $a->type,
                'starts_on' => $a->starts_on->toDateString(),
                'ends_on' => $a->ends_on->toDateString(),
            ])
            ->values();

        // --- Gépfoglalások (7. modul, csak olvasható réteg, ütközés-jelzéssel) ---
        $machineBookings = MachineBooking::query()
            ->overlapping($rangeStart->toDateString(), $rangeEnd->toDateString())
            ->with(['machine:id,name', 'project:id,code,name'])
            ->orderBy('starts_on')
            ->get();

        $conflictedBookings = $this->conflictedMachineBookingIds($machineBookings);

        $machineBookingItems = $machineBookings
            ->map(fn (MachineBooking $b) => [
                'key' => "gepfoglalas-{$b->id}",
                'machine_id' => $b->machine_id,
                'machine_name' => $b->machine?->name,
                'starts_on' => $b->starts_on->toDateString(),
                'ends_on' => $b->ends_on->toDateString(),
                'is_conflicted' => in_array($b->id, $conflictedBookings, true),
                'project' => $b->project
                    ? ['id' => $b->project->id, 'code' => $b->project->code, 'name' => $b->project->name]
                    : null,
            ])
            ->values();

        // --- Anyagszállítások / beérkezések (8. modul, csak olvasható réteg) ---
        // Tényleges beérkezésnél a received_on, egyébként a várható expected_on.
        $deliveries = MaterialProcurement::query()
            ->deliveringBetween($rangeStart->toDateString(), $rangeEnd->toDateString())
            ->with(['material:id,name,unit', 'project:id,code,name'])
            ->get()
            ->map(function (MaterialProcurement $p) {
                $date = $p->received_on ?? $p->expected_on;
                if ($date === null) {
                    return null;
                }

                return [
                    'key' => "szallitas-{$p->id}",
                    'date' => $date->toDateString(),
                    'material_name' => $p->material?->name,
                    'quantity' => (float) $p->quantity,
                    'unit_label' => $p->material ? (Materials::UNITS[$p->material->unit] ?? $p->material->unit) : null,
                    'received' => $p->received_on !== null,
                    'project' => $p->project
                        ? ['id' => $p->project->id, 'code' => $p->project->code, 'name' => $p->project->name]
                        : null,
                ];
            })
            ->filter()
            ->values();

        return Inertia::render('Scheduling/Index', [
            'view' => $view,
            'date' => $date->toDateString(),
            'range' => ['start' => $rangeStart->toDateString(), 'end' => $rangeEnd->toDateString()],
            'events' => $events->map(fn (CalendarEvent $e) => [
                'id' => $e->id,
                'title' => $e->title,
                'type' => $e->type,
                'project' => $e->project
                    ? ['id' => $e->project->id, 'code' => $e->project->code, 'name' => $e->project->name]
                    : null,
                'starts_on' => $e->starts_on->toDateString(),
                'ends_on' => $e->ends_on->toDateString(),
                'start_time' => $e->start_time ? substr($e->start_time, 0, 5) : null,
                'end_time' => $e->end_time ? substr($e->end_time, 0, 5) : null,
                'location' => $e->location,
                'note' => $e->note,
                'assignees' => $e->assignees->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values(),
                'creator_name' => $e->creator?->name,
                'can_manage' => $e->canBeManagedBy($user),
                'is_conflicted' => in_array($e->id, $conflicted, true),
            ])->values(),
            'milestones' => $milestones,
            'taskItems' => $taskItems,
            'absences' => $absences,
            'machineBookings' => $machineBookingItems,
            'deliveries' => $deliveries,
            'projects' => Project::orderBy('code')->get(['id', 'code', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name])->values(),
            'users' => User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name']),
            'types' => CalendarEvent::TYPES,
            'filters' => ['person' => $personFilter ?: null, 'type' => $typeFilter],
            'canCreate' => $user->can('scheduling.create'),
        ]);
    }

    public function store(CalendarEventRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // Személyes bejegyzéshez elég a naptár-hozzáférés; máshoz create jog kell.
        if ($data['type'] !== 'szemelyes') {
            abort_unless($request->user()->can('scheduling.create'), 403);
        }

        $event = CalendarEvent::create([
            ...collect($data)->except('assignees')->all(),
            'created_by' => $request->user()->id,
        ]);

        $event->assignees()->sync($data['assignees'] ?? []);

        return back()->with('success', 'A naptárbejegyzés létrejött.')
            ->with('info', $this->conflictWarning($event));
    }

    public function update(CalendarEventRequest $request, CalendarEvent $event): RedirectResponse
    {
        abort_unless($event->canBeManagedBy($request->user()), 403);

        $data = $request->validated();
        $event->update(collect($data)->except('assignees')->all());
        $event->assignees()->sync($data['assignees'] ?? []);

        return back()->with('success', 'A naptárbejegyzés módosítva.')
            ->with('info', $this->conflictWarning($event));
    }

    public function destroy(Request $request, CalendarEvent $event): RedirectResponse
    {
        abort_unless($event->canBeManagedBy($request->user()), 403);

        $event->delete();

        return back()->with('success', 'A naptárbejegyzés törölve.');
    }

    /**
     * Beosztás-ütközések: ugyanaz a személy egyszerre két helyen.
     *
     * @param  \Illuminate\Support\Collection<int, CalendarEvent>  $events
     * @return array<int, int>
     */
    private function conflictedEventIds($events): array
    {
        $byUserDay = [];

        foreach ($events->where('type', 'beosztas') as $event) {
            $day = CarbonImmutable::parse($event->starts_on);
            $end = CarbonImmutable::parse($event->ends_on);
            while ($day->lte($end)) {
                foreach ($event->assignees as $assignee) {
                    $byUserDay["{$assignee->id}|{$day->toDateString()}"][] = $event->id;
                }
                $day = $day->addDay();
            }
        }

        $conflicted = [];
        foreach ($byUserDay as $ids) {
            $unique = array_unique($ids);
            if (count($unique) > 1) {
                $conflicted = [...$conflicted, ...$unique];
            }
        }

        return array_values(array_unique($conflicted));
    }

    /**
     * Gépfoglalás-ütközések: ugyanaz a gép átfedő időszakra van foglalva.
     *
     * @param  \Illuminate\Support\Collection<int, MachineBooking>  $bookings
     * @return array<int, int>
     */
    private function conflictedMachineBookingIds($bookings): array
    {
        $conflicted = [];

        foreach ($bookings as $a) {
            foreach ($bookings as $b) {
                if ($a->id === $b->id || $a->machine_id !== $b->machine_id) {
                    continue;
                }
                if ($a->starts_on->lte($b->ends_on) && $a->ends_on->gte($b->starts_on)) {
                    $conflicted[$a->id] = $a->id;
                    break;
                }
            }
        }

        return array_values($conflicted);
    }

    /**
     * Mentés utáni figyelmeztetés, ha a beosztott személy máshol is dolgozik aznap.
     */
    private function conflictWarning(CalendarEvent $event): ?string
    {
        if ($event->type !== 'beosztas') {
            return null;
        }

        $event->load('assignees:id,name');
        if ($event->assignees->isEmpty()) {
            return null;
        }

        $overlapping = CalendarEvent::query()
            ->where('id', '!=', $event->id)
            ->where('type', 'beosztas')
            ->whereDate('starts_on', '<=', $event->ends_on)
            ->whereDate('ends_on', '>=', $event->starts_on)
            ->whereHas('assignees', fn ($q) => $q->whereIn('users.id', $event->assignees->pluck('id')))
            ->with('assignees:id,name')
            ->get();

        if ($overlapping->isEmpty()) {
            return null;
        }

        $names = $overlapping
            ->flatMap(fn ($e) => $e->assignees->pluck('name'))
            ->intersect($event->assignees->pluck('name'))
            ->unique()
            ->implode(', ');

        return "Figyelem, ütközés: {$names} ezen a napon másik beosztásban is szerepel.";
    }
}
