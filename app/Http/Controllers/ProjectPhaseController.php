<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectPhaseRequest;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Services\WorkdayCalendar;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectPhaseController extends Controller
{
    public function store(ProjectPhaseRequest $request, Project $project): RedirectResponse
    {
        $data = $request->validated();
        $deps = $this->validDependencies($project, $data['depends_on'] ?? [], null);

        $phase = $project->phases()->create([
            ...collect($data)->except(['depends_on', 'resources'])->all(),
            'sort_order' => ((int) $project->phases()->max('sort_order')) + 1,
        ]);

        $phase->dependencies()->sync($deps);
        $this->syncResources($phase, $data['resources'] ?? []);

        $project->logActivity('fazis', "Új fázis: {$phase->name}");

        return back()->with('success', 'A fázis hozzáadva.');
    }

    public function update(ProjectPhaseRequest $request, ProjectPhase $phase): RedirectResponse
    {
        $data = $request->validated();
        $project = $phase->project;

        $deps = $this->validDependencies($project, $data['depends_on'] ?? [], $phase);

        $wasDone = $phase->progress === 100;
        $phase->update(collect($data)->except(['depends_on', 'resources'])->all());
        $phase->dependencies()->sync($deps);
        $this->syncResources($phase, $data['resources'] ?? []);

        if (! $wasDone && $phase->progress === 100) {
            $project->logActivity('fazis', "Fázis elkészült: {$phase->name}");
        }

        return back()->with('success', 'A fázis módosítva.');
    }

    public function destroy(ProjectPhase $phase): RedirectResponse
    {
        $phase->project->logActivity('fazis', "Fázis törölve: {$phase->name}");
        $phase->delete();

        return back()->with('success', 'A fázis törölve.');
    }

    /**
     * A fázis kezdő- és végdátumának kiszámítása a függőségeiből
     * (típus + eltolás + munkanapok). Csak ezt a fázist érinti.
     */
    public function compute(ProjectPhase $phase): RedirectResponse
    {
        $phase->load('dependencies');
        if ($phase->dependencies->isEmpty()) {
            return back()->with('info', 'Ehhez a fázishoz nincs függőség, amiből számolni lehetne.');
        }

        $workDays = $phase->work_days
            ?: ($phase->starts_on && $phase->due_on
                ? WorkdayCalendar::workdaysBetween(
                    CarbonImmutable::parse($phase->starts_on),
                    CarbonImmutable::parse($phase->due_on),
                )
                : 1);

        $candidateStarts = [];
        $candidateEnds = [];

        foreach ($phase->dependencies as $dep) {
            if (! $dep->starts_on || ! $dep->due_on) {
                continue;
            }
            $bStart = CarbonImmutable::parse($dep->starts_on);
            $bEnd = CarbonImmutable::parse($dep->due_on);
            $lag = (int) $dep->pivot->lag_days;

            match ($dep->pivot->dep_type) {
                'kk' => $candidateStarts[] = WorkdayCalendar::addWorkdays($bStart, $lag),
                'bb' => $candidateEnds[] = WorkdayCalendar::addWorkdays($bEnd, $lag),
                'kb' => $candidateEnds[] = WorkdayCalendar::addWorkdays($bStart, $lag),
                default => $candidateStarts[] = WorkdayCalendar::addWorkdays($bEnd, $lag), // bk
            };
        }

        // A legkésőbbi megkötés a mérvadó (minden előfeltétel teljesüljön).
        $start = null;
        $end = null;
        if ($candidateStarts) {
            $start = collect($candidateStarts)->sortDesc()->first();
        }
        if ($candidateEnds) {
            $end = collect($candidateEnds)->sortDesc()->first();
            // Ha a végdátum a megkötés, a kezdés a munkanapokból visszafelé jön.
            if (! $start) {
                $start = WorkdayCalendar::addWorkdays($end, -($workDays - 1));
            }
        }

        if (! $start) {
            return back()->with('info', 'A függőségek dátumai hiányoznak — előbb az elődöknél adja meg őket.');
        }

        $start = WorkdayCalendar::nextWorkday($start, includeSelf: true);
        $end = $end ?? WorkdayCalendar::endFromStart($start, $workDays);

        $phase->update([
            'starts_on' => $start->toDateString(),
            'due_on' => $end->toDateString(),
            'work_days' => WorkdayCalendar::workdaysBetween($start, $end),
        ]);

        return back()->with('success', "A(z) „{$phase->name}” dátumai a függőségekből kiszámítva.");
    }

    /**
     * Fázis mozgatása felfelé/lefelé a sorrendben.
     */
    public function move(Request $request, ProjectPhase $phase): RedirectResponse
    {
        $request->validate(['direction' => ['required', 'in:up,down']]);

        $neighbour = $phase->project->phases()
            ->when(
                $request->input('direction') === 'up',
                fn ($q) => $q->where('sort_order', '<', $phase->sort_order)->orderByDesc('sort_order'),
                fn ($q) => $q->where('sort_order', '>', $phase->sort_order)->orderBy('sort_order'),
            )
            ->first();

        if ($neighbour) {
            DB::transaction(function () use ($phase, $neighbour) {
                [$a, $b] = [$phase->sort_order, $neighbour->sort_order];
                $phase->update(['sort_order' => $b]);
                $neighbour->update(['sort_order' => $a]);
            });
        }

        return back();
    }

    /**
     * @param  array<int, array{name:string,quantity:int,work_days:int,kind:string,note?:string}>  $resources
     */
    private function syncResources(ProjectPhase $phase, array $resources): void
    {
        $phase->resources()->delete();
        foreach ($resources as $r) {
            $phase->resources()->create([
                'kind' => $r['kind'],
                'name' => $r['name'],
                'quantity' => $r['quantity'],
                'work_days' => $r['work_days'],
                'note' => $r['note'] ?? null,
            ]);
        }
    }

    /**
     * Függőségek tisztítása és pivot-adat előállítása a sync-hez.
     * Csak azonos projektbeli, nem önmagára mutató fázisok, kör nélkül.
     *
     * @param  array<int, array{id:int|string,type:string,lag:int}>  $deps
     * @return array<int, array{dep_type:string,lag_days:int}>  [phaseId => pivot]
     */
    private function validDependencies(Project $project, array $deps, ?ProjectPhase $phase): array
    {
        $projectPhaseIds = $project->phases()->pluck('id');

        $clean = [];
        foreach ($deps as $dep) {
            $id = (int) ($dep['id'] ?? 0);
            if (! $projectPhaseIds->contains($id)) {
                continue;
            }
            if ($phase && $id === $phase->id) {
                continue;
            }
            $clean[$id] = [
                'dep_type' => in_array($dep['type'] ?? 'bk', ['bk', 'kk', 'bb', 'kb'], true) ? $dep['type'] : 'bk',
                'lag_days' => (int) ($dep['lag'] ?? 0),
            ];
        }

        if ($phase && $clean) {
            $edges = DB::table('phase_dependencies')
                ->whereIn('phase_id', $projectPhaseIds)
                ->get()
                ->groupBy('phase_id')
                ->map(fn ($rows) => $rows->pluck('depends_on_id')->all());

            foreach (array_keys($clean) as $startId) {
                $stack = [$startId];
                $seen = [];
                while ($stack) {
                    $current = array_pop($stack);
                    if ($current === $phase->id) {
                        throw ValidationException::withMessages([
                            'depends_on' => 'A kiválasztott függőség kört hozna létre.',
                        ]);
                    }
                    if (isset($seen[$current])) {
                        continue;
                    }
                    $seen[$current] = true;
                    foreach ($edges->get($current, []) as $next) {
                        $stack[] = $next;
                    }
                }
            }
        }

        return $clean;
    }
}
