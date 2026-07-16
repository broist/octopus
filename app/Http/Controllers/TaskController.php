<?php

namespace App\Http\Controllers;

use App\Http\Requests\TaskRequest;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $projectId = $request->integer('project');
        $priority = $request->string('priority')->toString();
        $mine = $request->boolean('mine');

        $tasks = Task::query()
            ->when($mine, fn ($q) => $q->whereHas('assignees', fn ($a) => $a->where('users.id', $request->user()->id)))
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->when($priority !== '', fn ($q) => $q->where('priority', $priority))
            ->when($search !== '', fn ($q) => $q->where('title', 'ilike', "%{$search}%"))
            ->with(['project:id,code,name', 'assignees:id,name'])
            ->orderByRaw("case priority when 'magas' then 0 when 'kozepes' then 1 else 2 end")
            ->orderByRaw('due_on asc nulls last')
            ->orderBy('id')
            ->get()
            ->map(fn (Task $t) => [
                'id' => $t->id,
                'title' => $t->title,
                'description' => $t->description,
                'status' => $t->status,
                'priority' => $t->priority,
                'due_on' => $t->due_on?->toDateString(),
                'is_overdue' => $t->isOverdue(),
                'project' => $t->project
                    ? ['id' => $t->project->id, 'code' => $t->project->code, 'name' => $t->project->name]
                    : null,
                'assignees' => $t->assignees->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values(),
                'can_move' => $t->canBeMovedBy($request->user()),
                'completed_at' => $t->completed_at?->toIso8601String(),
            ]);

        return Inertia::render('Tasks/Index', [
            'tasks' => $tasks,
            'filters' => [
                'search' => $search,
                'project' => $projectId ?: null,
                'priority' => $priority,
                'mine' => $mine,
            ],
            'statuses' => Task::STATUSES,
            'priorities' => Task::PRIORITIES,
            'users' => User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name']),
            'projects' => Project::orderBy('code')->get(['id', 'code', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'label' => "{$p->code} – {$p->name}"])->values(),
        ]);
    }

    public function store(TaskRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $task = Task::create([
            ...collect($data)->except('assignees')->all(),
            'completed_at' => $data['status'] === 'kesz' ? now() : null,
            'created_by' => $request->user()->id,
        ]);

        $task->assignees()->sync($data['assignees'] ?? []);

        $task->project?->logActivity('feladat', "Új feladat: {$task->title}");

        return back()->with('success', 'A feladat létrehozva.');
    }

    public function update(TaskRequest $request, Task $task): RedirectResponse
    {
        $data = $request->validated();
        $wasDone = $task->status === 'kesz';

        $task->update([
            ...collect($data)->except('assignees')->all(),
            'completed_at' => $data['status'] === 'kesz'
                ? ($task->completed_at ?? now())
                : null,
        ]);

        $task->assignees()->sync($data['assignees'] ?? []);

        if (! $wasDone && $task->status === 'kesz') {
            $task->project?->logActivity('feladat', "Feladat elkészült: {$task->title}");
        }

        return back()->with('success', 'A feladat módosítva.');
    }

    /**
     * Gyors státuszváltás (kanban áthúzás / kipipálás). Modul-jogosultság
     * nélkül is engedett annak, akire a feladat ki van osztva.
     */
    public function updateStatus(Request $request, Task $task): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(Task::STATUSES))],
        ]);

        $task->load('assignees');
        abort_unless($task->canBeMovedBy($request->user()), 403);

        $wasDone = $task->status === 'kesz';

        $task->update([
            'status' => $data['status'],
            'completed_at' => $data['status'] === 'kesz' ? ($task->completed_at ?? now()) : null,
        ]);

        if (! $wasDone && $task->status === 'kesz') {
            $task->project?->logActivity('feladat', "Feladat elkészült: {$task->title}");
        }

        return back();
    }

    public function destroy(Task $task): RedirectResponse
    {
        $task->delete();

        return back()->with('success', 'A feladat törölve.');
    }
}
