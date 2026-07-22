<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectRequest;
use App\Models\Partner;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    /**
     * Projektlista: csak főprojektek, szűréssel és kereséssel.
     */
    public function index(Request $request): Response
    {
        $status = $request->string('status')->toString();
        $search = $request->string('search')->toString();

        $projects = Project::query()
            ->whereNull('parent_id')
            ->when($status !== '', fn ($q) => $q->where('status', $status))
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('code', 'ilike', "%{$search}%")
                        ->orWhereHas('client', fn ($c) => $c->where('name', 'ilike', "%{$search}%"));
                });
            })
            ->with(['client:id,name', 'projectManager:id,name'])
            ->withCount(['subprojects', 'phases', 'subprojectPhases'])
            ->withAvg('phases as phases_progress', 'progress')
            ->withAvg('subprojectPhases as sub_phases_progress', 'progress')
            ->withCount(['phases as overdue_count' => function ($q) {
                $q->where('progress', '<', 100)
                    ->whereNotNull('due_on')
                    ->whereDate('due_on', '<', today());
            }])
            // Az alprojektek csúszása a főprojektet is "Csúszik"-ra jelöli.
            ->withCount(['subprojectPhases as sub_overdue_count' => function ($q) {
                $q->where('progress', '<', 100)
                    ->whereNotNull('due_on')
                    ->whereDate('due_on', '<', today());
            }])
            ->orderByDesc('updated_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Project $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'status' => $p->status,
                'client_name' => $p->client?->name,
                'pm_name' => $p->projectManager?->name,
                'starts_on' => $p->starts_on?->toDateString(),
                'ends_on' => $p->ends_on?->toDateString(),
                'progress' => $p->phases_count > 0
                    ? (int) round((float) $p->phases_progress)
                    : ($p->subproject_phases_count > 0 ? (int) round((float) $p->sub_phases_progress) : 0),
                'subprojects_count' => $p->subprojects_count,
                'phases_count' => $p->phases_count,
                'is_slipping' => ($p->overdue_count + $p->sub_overdue_count) > 0,
            ]);

        return Inertia::render('Projects/Index', [
            'projects' => $projects,
            'filters' => ['status' => $status, 'search' => $search],
            'statuses' => Project::STATUSES,
        ]);
    }

    public function create(Request $request): Response
    {
        $parent = null;
        if ($request->filled('parent')) {
            $p = Project::whereNull('parent_id')->find($request->integer('parent'));
            if ($p) {
                $parent = [
                    'id' => $p->id,
                    'code' => $p->code,
                    'name' => $p->name,
                    'client_id' => $p->client_id,
                    'project_manager_id' => $p->project_manager_id,
                    'status' => $p->status,
                ];
            }
        }

        return Inertia::render('Projects/Create', [
            ...$this->formOptions(),
            'parent' => $parent,
            'suggestedCode' => $this->suggestCode($parent['code'] ?? null),
        ]);
    }

    public function store(ProjectRequest $request): RedirectResponse
    {
        $project = Project::create($request->validated());

        $project->logActivity('letrehozva', $project->parent_id
            ? "Alprojekt létrehozva: {$project->name}"
            : "Projekt létrehozva: {$project->name}");

        if ($project->parent_id) {
            $project->parent->logActivity('alprojekt', "Új alprojekt: {$project->name}");
        }

        return redirect()
            ->route('projects.show', $project)
            ->with('success', 'A projekt sikeresen létrejött.');
    }

    public function show(Request $request, Project $project): Response
    {
        $project->load([
            'client:id,name',
            'projectManager:id,name',
            'parent:id,code,name',
            'phases.dependencies:id',
            'phases.resources',
            'subprojects' => fn ($q) => $q->withAvg('phases as phases_progress', 'progress')
                ->withCount('phases')
                ->withCount(['phases as overdue_count' => function ($q) {
                    $q->where('progress', '<', 100)
                        ->whereNotNull('due_on')
                        ->whereDate('due_on', '<', today());
                }]),
            'activities' => fn ($q) => $q->with('user:id,name')->limit(30),
            // Csak a felhasználó számára látható (mappa-ACL) dokumentumok.
            'documents' => fn ($q) => $q->visibleTo($request->user())
                ->with(['currentVersion', 'uploader:id,name']),
        ]);

        return Inertia::render('Projects/Show', [
            'project' => [
                'id' => $project->id,
                'code' => $project->code,
                'name' => $project->name,
                'status' => $project->status,
                'construction_type' => $project->construction_type,
                'client' => $project->client ? ['id' => $project->client->id, 'name' => $project->client->name] : null,
                'project_manager' => $project->projectManager ? ['id' => $project->projectManager->id, 'name' => $project->projectManager->name] : null,
                'parent' => $project->parent ? ['id' => $project->parent->id, 'code' => $project->parent->code, 'name' => $project->parent->name] : null,
                'location_city' => $project->location_city,
                'location_address' => $project->location_address,
                'starts_on' => $project->starts_on?->toDateString(),
                'ends_on' => $project->ends_on?->toDateString(),
                'description' => $project->description,
                'progress' => $project->progress(),
                'is_slipping' => $project->phases->contains(fn ($ph) => $ph->isOverdue())
                    || $project->subprojects->contains(fn ($sp) => $sp->overdue_count > 0),
            ],
            'phases' => $project->phases->values()->map(fn ($ph, $i) => [
                'id' => $ph->id,
                'seq' => $i + 1,
                'name' => $ph->name,
                'sort_order' => $ph->sort_order,
                'starts_on' => $ph->starts_on?->toDateString(),
                'due_on' => $ph->due_on?->toDateString(),
                'work_days' => $ph->work_days,
                'progress' => $ph->progress,
                'note' => $ph->note,
                'is_overdue' => $ph->isOverdue(),
                'depends_on' => $ph->dependencies->pluck('id')->values(),
                'dependencies' => $ph->dependencies->map(fn ($d) => [
                    'id' => $d->id,
                    'type' => $d->pivot->dep_type,
                    'lag' => (int) $d->pivot->lag_days,
                ])->values(),
                'resources' => $ph->resources->map(fn ($r) => [
                    'id' => $r->id,
                    'kind' => $r->kind,
                    'name' => $r->name,
                    'quantity' => $r->quantity,
                    'work_days' => $r->work_days,
                    'note' => $r->note,
                ])->values(),
            ])->values(),
            'subprojects' => $project->subprojects->map(fn ($sp) => [
                'id' => $sp->id,
                'code' => $sp->code,
                'name' => $sp->name,
                'status' => $sp->status,
                'progress' => $sp->phases_count > 0 ? (int) round((float) $sp->phases_progress) : 0,
                'phases_count' => $sp->phases_count,
                'is_slipping' => $sp->overdue_count > 0,
            ])->values(),
            'activities' => $project->activities->map(fn ($a) => [
                'id' => $a->id,
                'type' => $a->type,
                'description' => $a->description,
                'user_name' => $a->user?->name,
                'created_at' => $a->created_at->toIso8601String(),
            ])->values(),
            'documents' => $project->documents->map(fn ($d) => [
                'id' => $d->id,
                'title' => $d->title,
                'category' => $d->category,
                'version_number' => $d->currentVersion?->version_number ?? 0,
                'original_filename' => $d->currentVersion?->original_filename,
                'size_bytes' => $d->currentVersion?->size_bytes ?? 0,
                'download_version_id' => $d->currentVersion?->id,
                'uploader_name' => $d->uploader?->name,
                'updated_at' => $d->updated_at->toIso8601String(),
            ])->values(),
            'statuses' => Project::STATUSES,
            'types' => Project::CONSTRUCTION_TYPES,
        ]);
    }

    public function edit(Project $project): Response
    {
        return Inertia::render('Projects/Edit', [
            ...$this->formOptions(),
            'project' => [
                'id' => $project->id,
                'parent_id' => $project->parent_id,
                'code' => $project->code,
                'name' => $project->name,
                'status' => $project->status,
                'construction_type' => $project->construction_type,
                'client_id' => $project->client_id,
                'project_manager_id' => $project->project_manager_id,
                'location_city' => $project->location_city,
                'location_address' => $project->location_address,
                'starts_on' => $project->starts_on?->toDateString(),
                'ends_on' => $project->ends_on?->toDateString(),
                'description' => $project->description,
            ],
        ]);
    }

    public function update(ProjectRequest $request, Project $project): RedirectResponse
    {
        $oldStatus = $project->status;

        $project->update($request->validated());

        if ($project->wasChanged('status')) {
            $project->logActivity('statusz', sprintf(
                'Státusz módosítva: %s → %s',
                Project::STATUSES[$oldStatus] ?? $oldStatus,
                Project::STATUSES[$project->status] ?? $project->status,
            ));
        } elseif ($project->wasChanged()) {
            $project->logActivity('modositva', 'Projekt adatai módosítva.');
        }

        return redirect()
            ->route('projects.show', $project)
            ->with('success', 'A projekt módosításai elmentve.');
    }

    public function destroy(Project $project): RedirectResponse
    {
        $parent = $project->parent;
        $name = $project->name;

        $project->delete();

        if ($parent) {
            $parent->logActivity('torolve', "Alprojekt törölve: {$name}");

            return redirect()
                ->route('projects.show', $parent)
                ->with('success', 'Az alprojekt törölve.');
        }

        return redirect()
            ->route('projects.index')
            ->with('success', 'A projekt törölve.');
    }

    /**
     * Gyors megrendelő-felvétel a projekt űrlapról (a teljes partnerkezelés
     * a CRM modulban készül el).
     */
    public function quickClient(Request $request): JsonResponse
    {
        $data = $request->validate(
            ['name' => ['required', 'string', 'max:200']],
            ['name.required' => 'A megrendelő neve kötelező.'],
        );

        $partner = Partner::create([
            'name' => $data['name'],
            'is_client' => true,
        ]);

        return response()->json(['id' => $partner->id, 'name' => $partner->name]);
    }

    /* ------------------------------------------------------------------ */

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'clients' => Partner::clients()->orderBy('name')->get(['id', 'name']),
            'managers' => User::where('is_active', true)
                ->where('is_external', false)
                ->orderBy('name')
                ->get(['id', 'name']),
            'statuses' => Project::STATUSES,
            'types' => Project::CONSTRUCTION_TYPES,
        ];
    }

    private function suggestCode(?string $parentCode): string
    {
        return Project::suggestNextCode($parentCode);
    }
}
