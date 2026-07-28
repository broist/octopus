<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectPhaseRequest;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Services\PhaseTemplateImporter;
use App\Services\WorkdayCalendar;
use App\Support\PhaseTemplates;
use App\Support\PhaseTree;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProjectPhaseController extends Controller
{
    public function store(ProjectPhaseRequest $request, Project $project): RedirectResponse
    {
        $data = $request->validated();
        $deps = $this->validDependencies($project, $data['depends_on'] ?? [], null);

        // Az új fázis egy sablonból hozott csoport alá is beszúrható; enélkül
        // a fa végére, felső szintre kerül.
        $parent = ! empty($data['parent_id'])
            ? $project->phases()->where('is_group', true)->find($data['parent_id'])
            : null;

        $phase = $project->phases()->create([
            ...collect($data)->except(['depends_on', 'resources', 'parent_id'])->all(),
            'parent_id' => $parent?->id,
            'level' => $parent ? $parent->level + 1 : 0,
            'sort_order' => $this->positionFor($project, $parent),
            // Csúszás-elemzéshez (spec §15): a tényleges befejezés dátuma.
            'completed_on' => ((int) ($data['progress'] ?? 0)) === 100 ? today() : null,
        ]);

        $phase->dependencies()->sync($deps);
        $this->syncResources($phase, $data['resources'] ?? []);

        $project->logActivity('fazis', $parent
            ? "Új fázis: {$phase->name} ({$parent->name} alatt)"
            : "Új fázis: {$phase->name}");

        return back()->with('success', 'A fázis hozzáadva.');
    }

    /**
     * Ütemterv-sablon betöltése (spec §6): a kész munkastruktúra egy
     * kattintással bekerül, utána a nem odavaló sorok törölhetők.
     */
    public function importTemplate(
        Request $request,
        Project $project,
        PhaseTemplateImporter $importer,
    ): RedirectResponse {
        $data = $request->validate([
            'template' => ['required', 'string', Rule::in(array_keys(PhaseTemplates::all()))],
            'replace' => ['nullable', 'boolean'],
        ], [
            'template.required' => 'Válasszon ütemterv-sablont.',
            'template.in' => 'Ismeretlen ütemterv-sablon.',
        ]);

        $template = PhaseTemplates::find($data['template']);

        if ($request->boolean('replace')) {
            // A gyökér sorok törlése az egész fát viszi (FK cascade).
            $project->phases()->whereNull('parent_id')->delete();
        }

        $count = $importer->import($project, $template);

        $project->logActivity('fazis', "Ütemterv-sablon betöltve: {$template['name']} ({$count} sor)");

        return back()->with(
            'success',
            "A(z) „{$template['name']}” sablon betöltve — {$count} sor. A nem szükséges sorokat törölje."
        );
    }

    /**
     * Több fázis törlése egyszerre. Egy csoport törlése a teljes ágát viszi,
     * így a sablon fölösleges részei néhány kattintással megnyeshetők.
     */
    public function destroyMany(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
        ], [
            'ids.required' => 'Nincs kijelölt fázis.',
        ]);

        $ids = $project->phases()->whereIn('id', $data['ids'])->pluck('id');

        if ($ids->isEmpty()) {
            return back()->with('info', 'A kijelölt fázisok már nem léteznek.');
        }

        // A leszármazottak a FK cascade miatt automatikusan törlődnek — a
        // visszajelzéshez viszont előre kiszámoljuk a teljes darabszámot.
        $phases = $project->phases()->get(['id', 'parent_id', 'sort_order']);
        $affected = collect($ids)
            ->flatMap(fn (int $id) => PhaseTree::subtreeIds($phases, $id))
            ->unique()
            ->count();

        $project->phases()->whereIn('id', $ids)->delete();

        $project->logActivity('fazis', "{$affected} fázis törölve az ütemtervből.");

        return back()->with('success', "{$affected} fázis törölve.");
    }

    public function update(ProjectPhaseRequest $request, ProjectPhase $phase): RedirectResponse
    {
        $data = $request->validated();
        $project = $phase->project;

        $deps = $this->validDependencies($project, $data['depends_on'] ?? [], $phase);

        $except = ['depends_on', 'resources', 'parent_id'];

        // Összegző sornak nincs saját dátuma és készültsége — azok a gyerekekből
        // gördülnek fel, tehát csak a megnevezése és a megjegyzése írható.
        if ($phase->is_group) {
            $except = [...$except, 'starts_on', 'due_on', 'work_days', 'progress'];
        }

        $wasDone = $phase->progress === 100;
        $phase->update(collect($data)->except($except)->all());
        $phase->dependencies()->sync($deps);
        $this->syncResources($phase, $data['resources'] ?? []);

        // A tényleges befejezés dátuma (csúszás-elemzés, spec §15): a 100%-ra
        // váltás napja. Ha a készültség visszaesik, a dátum törlődik.
        if (! $wasDone && $phase->progress === 100) {
            $phase->update(['completed_on' => today()]);
            $project->logActivity('fazis', "Fázis elkészült: {$phase->name}");
        } elseif ($wasDone && $phase->progress < 100) {
            $phase->update(['completed_on' => null]);
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
     * Fázis mozgatása felfelé/lefelé — a testvérei között, a saját ágával együtt.
     * A fa szerkezete nem változik, csak két szomszédos ág cserél helyet.
     */
    public function move(Request $request, ProjectPhase $phase): RedirectResponse
    {
        $request->validate(['direction' => ['required', 'in:up,down']]);

        $project = $phase->project;
        $phases = $project->phases()->get();

        $siblings = PhaseTree::siblingsOf($phases, $phase);
        $index = null;
        foreach ($siblings as $i => $sibling) {
            if ($sibling->id === $phase->id) {
                $index = $i;
                break;
            }
        }

        $target = $index + ($request->input('direction') === 'up' ? -1 : 1);
        if ($index === null || $target < 0 || $target >= count($siblings)) {
            return back();
        }

        // A két testvér ága a mélységi sorrendben egymás melletti, összefüggő
        // blokk — elég a két blokkot megcserélni, a fa többi része nem mozdul.
        [$firstId, $secondId] = $target < $index
            ? [$siblings[$target]->id, $phase->id]
            : [$phase->id, $siblings[$target]->id];

        $ordered = PhaseTree::flatten($phases)->values();
        $firstSize = count(PhaseTree::subtreeIds($phases, $firstId));
        $secondSize = count(PhaseTree::subtreeIds($phases, $secondId));
        $start = (int) $ordered->search(fn (ProjectPhase $p) => $p->id === $firstId);

        PhaseTree::resequence($phases, $ordered
            ->slice(0, $start)
            ->concat($ordered->slice($start + $firstSize, $secondSize))
            ->concat($ordered->slice($start, $firstSize))
            ->concat($ordered->slice($start + $firstSize + $secondSize))
            ->values());

        return back();
    }

    /**
     * Hova kerüljön az új fázis: a fa végére, vagy a választott csoport ágának
     * a végére (ilyenkor a mögötte lévő sorok eggyel odébb tolódnak).
     */
    private function positionFor(Project $project, ?ProjectPhase $parent): int
    {
        if ($parent === null) {
            return ((int) $project->phases()->max('sort_order')) + 1;
        }

        $ids = PhaseTree::subtreeIds(
            $project->phases()->get(['id', 'parent_id', 'sort_order']),
            $parent->id,
        );

        $position = ((int) ProjectPhase::whereIn('id', $ids)->max('sort_order')) + 1;

        $project->phases()->where('sort_order', '>=', $position)->increment('sort_order');

        return $position;
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
