<?php

namespace App\Http\Controllers;

use App\Http\Requests\TaskRequest;
use App\Models\Document;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class TaskController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $projectId = $request->integer('project');
        $priority = $request->string('priority')->toString();
        $creatorId = $request->integer('creator');
        $assigneeId = $request->integer('assignee');
        $scope = $request->string('scope')->toString(); // '' | 'project' | 'internal'
        $mine = $request->boolean('mine');

        // A hatókör (scope) kivételével minden szűrő közös — a lista és a
        // hatókör-darabszámok is ezt használják.
        $applyFilters = fn ($q) => $q
            ->when($mine, fn ($q) => $q->whereHas('assignees', fn ($a) => $a->where('users.id', $request->user()->id)))
            ->when($assigneeId > 0, fn ($q) => $q->whereHas('assignees', fn ($a) => $a->where('users.id', $assigneeId)))
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->when($priority !== '', fn ($q) => $q->where('priority', $priority))
            ->when($creatorId > 0, fn ($q) => $q->where('created_by', $creatorId))
            ->when($search !== '', fn ($q) => $q->where('title', 'ilike', "%{$search}%"));

        // Hatókör-darabszámok (a scope szűrő nélkül) — a szegmens-váltóhoz.
        $scopeCounts = [
            'all' => $applyFilters(Task::query())->count(),
            'project' => $applyFilters(Task::query())->whereNotNull('project_id')->count(),
            'internal' => $applyFilters(Task::query())->whereNull('project_id')->count(),
        ];

        $tasks = $applyFilters(Task::query())
            ->when($scope === 'project', fn ($q) => $q->whereNotNull('project_id'))
            ->when($scope === 'internal', fn ($q) => $q->whereNull('project_id'))
            ->with(['project:id,code,name', 'assignees:id,name', 'creator:id,name', 'attachments'])
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
                'creator' => $t->creator ? ['id' => $t->creator->id, 'name' => $t->creator->name] : null,
                'created_at' => $t->created_at->toIso8601String(),
                'can_move' => $t->canBeMovedBy($request->user()),
                'completed_at' => $t->completed_at?->toIso8601String(),
                'attachments' => $t->attachments->map(fn (TaskAttachment $a) => [
                    'id' => $a->id,
                    'name' => $a->original_filename,
                    'size' => $a->size_bytes,
                    'is_image' => $a->isImage(),
                    'url' => route('tasks.attachments.download', $a->id),
                ])->values(),
            ]);

        return Inertia::render('Tasks/Index', [
            'tasks' => $tasks,
            'filters' => [
                'search' => $search,
                'project' => $projectId ?: null,
                'priority' => $priority,
                'creator' => $creatorId ?: null,
                'assignee' => $assigneeId ?: null,
                'scope' => $scope,
                'mine' => $mine,
            ],
            'scopeCounts' => $scopeCounts,
            'statuses' => Task::STATUSES,
            'priorities' => Task::PRIORITIES,
            'users' => User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name']),
            'creators' => User::whereIn('id', Task::query()->whereNotNull('created_by')->distinct()->pluck('created_by'))
                ->orderBy('name')->get(['id', 'name']),
            'projects' => Project::orderBy('code')->get(['id', 'code', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'label' => "{$p->code} – {$p->name}"])->values(),
        ]);
    }

    public function store(TaskRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $task = Task::create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'project_id' => $data['project_id'] ?? null,
            'status' => $data['status'],
            'priority' => $data['priority'],
            'due_on' => $data['due_on'],
            'completed_at' => $data['status'] === 'kesz' ? now() : null,
            'created_by' => $request->user()->id,
        ]);

        $task->assignees()->sync($data['assignees'] ?? []);
        $this->storeAttachments($request, $task);

        $task->project?->logActivity('feladat', "Új feladat: {$task->title}");

        return back()->with('success', 'A feladat létrehozva.');
    }

    public function update(TaskRequest $request, Task $task): RedirectResponse
    {
        $data = $request->validated();
        $wasDone = $task->status === 'kesz';

        $task->update([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'project_id' => $data['project_id'] ?? null,
            'status' => $data['status'],
            'priority' => $data['priority'],
            'due_on' => $data['due_on'],
            'completed_at' => $data['status'] === 'kesz' ? ($task->completed_at ?? now()) : null,
        ]);

        $task->assignees()->sync($data['assignees'] ?? []);

        // Törlésre jelölt csatolmányok eltávolítása.
        foreach ($data['remove_attachments'] ?? [] as $attachmentId) {
            $attachment = $task->attachments()->whereKey($attachmentId)->first();
            if ($attachment) {
                Storage::disk($attachment->disk)->delete($attachment->file_path);
                $attachment->delete();
            }
        }

        $this->storeAttachments($request, $task);

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
        foreach ($task->attachments as $attachment) {
            Storage::disk($attachment->disk)->delete($attachment->file_path);
        }

        $task->delete();

        return back()->with('success', 'A feladat törölve.');
    }

    public function downloadAttachment(Request $request, TaskAttachment $attachment): SymfonyResponse
    {
        abort_unless($request->user()->can('tasks.view'), 403);

        $storage = Storage::disk($attachment->disk);
        abort_unless($storage->exists($attachment->file_path), 404, 'A fájl nem található.');

        if ($attachment->disk === 'plans') {
            return redirect()->away($storage->temporaryUrl($attachment->file_path, now()->addMinutes(10)));
        }

        return $storage->download($attachment->file_path, $attachment->original_filename);
    }

    /**
     * A kérésben érkező feltöltött fájlok tárolása a feladathoz.
     */
    private function storeAttachments(Request $request, Task $task): void
    {
        foreach ($request->file('attachments') ?? [] as $file) {
            $disk = Document::diskFor('egyeb', (int) $file->getSize());
            $path = $file->store("task-{$task->id}", $disk);

            $task->attachments()->create([
                'disk' => $disk,
                'file_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);
        }
    }
}
