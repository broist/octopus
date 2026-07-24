<?php

namespace App\Http\Controllers;

use App\Models\CalendarEvent;
use App\Models\Machine;
use App\Models\Project;
use App\Models\ProjectActivity;
use App\Models\ProjectPhase;
use App\Models\StaffQualification;
use App\Models\SubcontractorCertification;
use App\Models\Task;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Vezérlőpult (spec §5/1): a többi modul legfontosabb adatai egy helyen.
     * A pénzügyi pillanatkép a Pénzügy modullal (9.) érkezik.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $today = today();
        $horizon = today()->addDays(14);

        $overdue = fn ($q) => $q->where('progress', '<', 100)
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<', $today);

        // --- Aktív projektek (top 5 + darabszám) ---
        $activeCount = Project::whereNull('parent_id')
            ->whereIn('status', ['szerzodott', 'folyamatban', 'atadas'])->count();

        $projects = Project::query()
            ->whereNull('parent_id')
            ->whereIn('status', ['szerzodott', 'folyamatban', 'atadas'])
            ->with('client:id,name')
            ->withCount(['phases', 'subprojectPhases'])
            ->withAvg('phases as phases_progress', 'progress')
            ->withAvg('subprojectPhases as sub_phases_progress', 'progress')
            ->withCount(['phases as overdue_count' => $overdue])
            ->withCount(['subprojectPhases as sub_overdue_count' => $overdue])
            ->orderByDesc('updated_at')
            ->limit(5)
            ->get()
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'status' => $p->status,
                'client_name' => $p->client?->name,
                'progress' => $p->phases_count > 0
                    ? (int) round((float) $p->phases_progress)
                    : ($p->subproject_phases_count > 0 ? (int) round((float) $p->sub_phases_progress) : 0),
                'is_slipping' => ($p->overdue_count + $p->sub_overdue_count) > 0,
            ]);

        // --- Közelgő határidők (fázisok + feladatok, 14 nap) ---
        $phaseDeadlines = ProjectPhase::query()
            ->where('progress', '<', 100)
            ->whereBetween('due_on', [$today->toDateString(), $horizon->toDateString()])
            ->with('project:id,code,name')
            ->get()
            ->map(fn ($ph) => [
                'key' => "fazis-{$ph->id}",
                'kind' => 'fazis',
                'date' => $ph->due_on->toDateString(),
                'label' => $ph->name,
                'project' => $ph->project ? ['id' => $ph->project->id, 'code' => $ph->project->code] : null,
            ]);

        $taskDeadlines = Task::query()
            ->where('status', '!=', 'kesz')
            ->whereBetween('due_on', [$today->toDateString(), $horizon->toDateString()])
            ->with('project:id,code')
            ->get()
            ->map(fn ($t) => [
                'key' => "feladat-{$t->id}",
                'kind' => 'feladat',
                'date' => $t->due_on->toDateString(),
                'label' => $t->title,
                'project' => $t->project ? ['id' => $t->project->id, 'code' => $t->project->code] : null,
            ]);

        $deadlines = $phaseDeadlines->concat($taskDeadlines)->sortBy('date')->values();

        // --- Riasztások: csúszó projektek + lejárt feladatok ---
        $slipping = Project::query()
            ->whereHas('phases', $overdue)
            ->get(['id', 'code', 'name'])
            ->map(fn ($p) => [
                'key' => "csuszik-{$p->id}",
                'text' => "{$p->code} – {$p->name}: lejárt határidejű fázis",
                'project_id' => $p->id,
            ]);

        $overdueTasksCount = Task::where('status', '!=', 'kesz')
            ->whereDate('due_on', '<', $today)->count();

        $alerts = $slipping->map(fn ($a) => $a + ['url' => null])->values()->all();
        if ($overdueTasksCount > 0) {
            $alerts[] = [
                'key' => 'lejart-feladatok',
                'text' => "{$overdueTasksCount} feladat határideje lejárt",
                'project_id' => null,
                'url' => null,
            ];
        }

        // Lejáró/lejárt alvállalkozói dokumentumok (spec §5/1: biztosítás,
        // engedély hamarosan lejár). Alvállalkozónként egy sor.
        $certHorizon = today()->addDays(30);
        $expiringCerts = SubcontractorCertification::query()
            ->whereNotNull('valid_until')
            ->whereDate('valid_until', '<=', $certHorizon->toDateString())
            ->whereHas('partner', fn ($q) => $q->where('is_subcontractor', true))
            ->with('partner:id,name')
            ->orderBy('valid_until')
            ->get()
            ->groupBy('partner_id');

        foreach ($expiringCerts as $partnerId => $certs) {
            $partner = $certs->first()->partner;
            if (! $partner) {
                continue;
            }
            $expired = $certs->filter(fn ($c) => $c->valid_until->isPast())->count();
            $text = $expired > 0
                ? "{$partner->name}: {$expired} lejárt dokumentum (biztosítás/engedély)"
                : "{$partner->name}: hamarosan lejáró dokumentum";
            $alerts[] = [
                'key' => "alv-cert-{$partnerId}",
                'text' => $text,
                'project_id' => null,
                'url' => route('subcontractors.show', $partnerId),
            ];
        }

        // Lejáró/lejárt munkatársi végzettségek (spec §5/6: lejárati
        // figyelmeztetés). Munkatársanként egy sor.
        $expiringQuals = StaffQualification::query()
            ->whereNotNull('valid_until')
            ->whereDate('valid_until', '<=', $certHorizon->toDateString())
            ->whereHas('user', fn ($q) => $q->where('is_external', false))
            ->with('user:id,name')
            ->orderBy('valid_until')
            ->get()
            ->groupBy('user_id');

        foreach ($expiringQuals as $userId => $quals) {
            $person = $quals->first()->user;
            if (! $person) {
                continue;
            }
            $expired = $quals->filter(fn ($q) => $q->valid_until->isPast())->count();
            $text = $expired > 0
                ? "{$person->name}: {$expired} lejárt végzettség / jogosultság"
                : "{$person->name}: hamarosan lejáró végzettség / jogosultság";
            $alerts[] = [
                'key' => "staff-qual-{$userId}",
                'text' => $text,
                'project_id' => null,
                'url' => route('staff.show', $userId),
            ];
        }

        // Lejáró/lejárt gép-karbantartás és műszaki vizsga (spec §7: lejárati
        // figyelmeztetés). Gépenként egy sor, a legközelebbi esedékesség szerint.
        $expiringMachines = Machine::query()
            ->where(fn ($q) => $q
                ->whereDate('next_service_on', '<=', $certHorizon->toDateString())
                ->orWhereDate('inspection_valid_until', '<=', $certHorizon->toDateString()))
            ->get();

        foreach ($expiringMachines as $machine) {
            $items = [];
            if ($machine->next_service_on && $machine->next_service_on->lte($certHorizon)) {
                $items[] = $machine->next_service_on->isPast() ? 'lejárt szerviz' : 'esedékes szerviz';
            }
            if ($machine->inspection_valid_until && $machine->inspection_valid_until->lte($certHorizon)) {
                $items[] = $machine->inspection_valid_until->isPast() ? 'lejárt műszaki vizsga' : 'közelgő műszaki vizsga';
            }
            if ($items === []) {
                continue;
            }
            $alerts[] = [
                'key' => "gep-{$machine->id}",
                'text' => "{$machine->name}: ".implode(', ', $items),
                'project_id' => null,
                'url' => route('machines.show', $machine->id),
            ];
        }

        // --- Mai nap: ki hol dolgozik + saját mai teendők ---
        $todayEvents = CalendarEvent::query()
            ->visibleTo($user)
            ->whereDate('starts_on', '<=', $today)
            ->whereDate('ends_on', '>=', $today)
            ->with(['project:id,code', 'assignees:id,name'])
            ->orderBy('start_time')
            ->limit(10)
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'type' => $e->type,
                'start_time' => $e->start_time ? substr($e->start_time, 0, 5) : null,
                'project_code' => $e->project?->code,
                'people' => $e->assignees->pluck('name')->implode(', '),
            ]);

        $myTasks = Task::query()
            ->where('status', '!=', 'kesz')
            ->whereHas('assignees', fn ($q) => $q->where('users.id', $user->id))
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<=', $today)
            ->orderBy('due_on')
            ->limit(6)
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'title' => $t->title,
                'overdue' => $t->isOverdue(),
            ]);

        // --- Legutóbbi tevékenység ---
        $activities = ProjectActivity::query()
            ->with(['user:id,name', 'project:id,code'])
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'description' => $a->description,
                'project' => $a->project ? ['id' => $a->project->id, 'code' => $a->project->code] : null,
                'user_name' => $a->user?->name,
                'created_at' => $a->created_at->toIso8601String(),
            ]);

        return Inertia::render('Dashboard/Index', [
            'stats' => [
                'active_projects' => $activeCount,
                'deadlines_14d' => $deadlines->count(),
                'open_tasks' => Task::where('status', '!=', 'kesz')->count(),
                'alerts' => count($alerts),
            ],
            'projects' => $projects,
            'deadlines' => $deadlines->take(7)->values(),
            'alerts' => $alerts,
            'todayEvents' => $todayEvents,
            'myTasks' => $myTasks,
            'activities' => $activities,
        ]);
    }
}
