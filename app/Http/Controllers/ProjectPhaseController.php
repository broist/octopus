<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectPhaseRequest;
use App\Models\Project;
use App\Models\ProjectPhase;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectPhaseController extends Controller
{
    public function store(ProjectPhaseRequest $request, Project $project): RedirectResponse
    {
        $data = $request->validated();
        $dependsOn = $this->validDependencyIds($project, $data['depends_on'] ?? [], null);

        $phase = $project->phases()->create([
            ...collect($data)->except('depends_on')->all(),
            'sort_order' => ((int) $project->phases()->max('sort_order')) + 1,
        ]);

        $phase->dependencies()->sync($dependsOn);

        $project->logActivity('fazis', "Új fázis: {$phase->name}");

        return back()->with('success', 'A fázis hozzáadva.');
    }

    public function update(ProjectPhaseRequest $request, ProjectPhase $phase): RedirectResponse
    {
        $data = $request->validated();
        $project = $phase->project;

        $dependsOn = $this->validDependencyIds($project, $data['depends_on'] ?? [], $phase);

        $wasDone = $phase->progress === 100;
        $phase->update(collect($data)->except('depends_on')->all());
        $phase->dependencies()->sync($dependsOn);

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
     * Függőség-lista tisztítása: csak azonos projektbeli, nem önmagára mutató
     * fázisok, és nem hozhat létre kört (A vár B-re, B vár A-ra).
     *
     * @param  array<int, int|string>  $ids
     * @return array<int, int>
     */
    private function validDependencyIds(Project $project, array $ids, ?ProjectPhase $phase): array
    {
        $ids = collect($ids)->map(fn ($v) => (int) $v)->unique();

        $projectPhaseIds = $project->phases()->pluck('id');
        $ids = $ids->intersect($projectPhaseIds);

        if ($phase) {
            $ids = $ids->reject(fn ($id) => $id === $phase->id);

            // Kör-ellenőrzés: a kiválasztott függőségektől indulva elérhető-e ez a fázis?
            $edges = DB::table('phase_dependencies')
                ->whereIn('phase_id', $projectPhaseIds)
                ->get()
                ->groupBy('phase_id')
                ->map(fn ($rows) => $rows->pluck('depends_on_id')->all());

            foreach ($ids as $startId) {
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

        return $ids->values()->all();
    }
}
