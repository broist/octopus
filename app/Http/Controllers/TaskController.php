<?php

namespace App\Http\Controllers;

use App\Http\Requests\TaskRequest;
use App\Models\Document;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\TaskComment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class TaskController extends Controller
{
    /**
     * Alapból a lezárt feladatok nincsenek szem előtt — a felhasználó az
     * Állapot szűrőben bármikor visszakapcsolhatja őket (vagy elrejthet
     * továbbiakat), a választás az URL-ben marad.
     */
    private const DEFAULT_HIDDEN_STATUSES = 'kesz';

    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $projectId = $request->integer('project');
        $priority = $request->string('priority')->toString();
        $creatorId = $request->integer('creator');
        $assigneeId = $request->integer('assignee');
        $scope = $request->string('scope')->toString(); // '' | 'project' | 'internal'
        $mine = $request->boolean('mine');

        // Elrejtett állapotok (vesszős lista). A paraméter hiánya = alapbeállítás,
        // az üres string viszont azt jelenti: a felhasználó mindent látni akar.
        $hiddenParam = $request->has('hidden')
            ? $request->string('hidden')->toString()
            : self::DEFAULT_HIDDEN_STATUSES;
        $hidden = array_values(array_intersect(
            array_filter(array_map('trim', explode(',', $hiddenParam))),
            array_keys(Task::STATUSES),
        ));

        // Szűkítés a lezárás dátumára (csak akkor van értelme, ha a Kész látszik).
        $doneFrom = $request->string('done_from')->toString();
        $doneTo = $request->string('done_to')->toString();

        // A hatókör és az állapot-elrejtés kivételével minden szűrő közös — a
        // lista és a darabszámok is ezt használják.
        $applyFilters = fn ($q) => $q
            ->when($mine, fn ($q) => $q->whereHas('assignees', fn ($a) => $a->where('users.id', $request->user()->id)))
            ->when($assigneeId > 0, fn ($q) => $q->whereHas('assignees', fn ($a) => $a->where('users.id', $assigneeId)))
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->when($priority !== '', fn ($q) => $q->where('priority', $priority))
            ->when($creatorId > 0, fn ($q) => $q->where('created_by', $creatorId))
            ->when($search !== '', fn ($q) => $q->where('title', 'ilike', "%{$search}%"));

        $applyScope = fn ($q) => $q
            ->when($scope === 'project', fn ($q) => $q->whereNotNull('project_id'))
            ->when($scope === 'internal', fn ($q) => $q->whereNull('project_id'));

        // Elrejtett állapotok + lezárási dátumtartomány. A dátumszűrőt csak akkor
        // engedjük érvényre jutni, ha a Kész látszik: elrejtett Kész mellett a
        // completed_at minden feladatnál üres, azaz mindent kiszűrne.
        $doneRangeApplies = ! in_array('kesz', $hidden, true);
        $applyState = fn ($q) => $q
            ->when($hidden !== [], fn ($q) => $q->whereNotIn('status', $hidden))
            ->when($doneRangeApplies && $doneFrom !== '', fn ($q) => $q->whereDate('completed_at', '>=', $doneFrom))
            ->when($doneRangeApplies && $doneTo !== '', fn ($q) => $q->whereDate('completed_at', '<=', $doneTo));

        // Hatókör-darabszámok (a scope szűrő nélkül) — a szegmens-váltóhoz.
        $scopeCounts = [
            'all' => $applyState($applyFilters(Task::query()))->count(),
            'project' => $applyState($applyFilters(Task::query()))->whereNotNull('project_id')->count(),
            'internal' => $applyState($applyFilters(Task::query()))->whereNull('project_id')->count(),
        ];

        // Állapotonkénti darabszám (az elrejtés nélkül) — az Állapot szűrőben
        // így az is látszik, hány feladat van az éppen elrejtett állapotokban.
        $statusCounts = [];
        foreach (array_keys(Task::STATUSES) as $status) {
            $statusCounts[$status] = $applyScope($applyFilters(Task::query()))
                ->where('status', $status)->count();
        }

        $tasks = $applyState($applyScope($applyFilters(Task::query())))
            ->with(['project:id,code,name', 'assignees:id,name', 'creator:id,name', 'attachments'])
            ->withCount(['comments as comments_count' => fn ($q) => $q->where('kind', TaskComment::KIND_COMMENT)])
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
                'comments_count' => (int) $t->comments_count,
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
                'hidden' => $hidden,
                'done_from' => $doneFrom,
                'done_to' => $doneTo,
            ],
            'scopeCounts' => $scopeCounts,
            'statusCounts' => $statusCounts,
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

        $task->logStatusChange(null, $task->status, $request->user());
        $task->project?->logActivity('feladat', "Új feladat: {$task->title}");

        return back()->with('success', 'A feladat létrehozva.');
    }

    public function update(TaskRequest $request, Task $task): RedirectResponse
    {
        $data = $request->validated();
        $wasDone = $task->status === 'kesz';
        $previousStatus = $task->status;

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

        $task->logStatusChange($previousStatus, $task->status, $request->user());

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
        $previousStatus = $task->status;

        $task->update([
            'status' => $data['status'],
            'completed_at' => $data['status'] === 'kesz' ? ($task->completed_at ?? now()) : null,
        ]);

        $task->logStatusChange($previousStatus, $task->status, $request->user());

        if (! $wasDone && $task->status === 'kesz') {
            $task->project?->logActivity('feladat', "Feladat elkészült: {$task->title}");
        }

        return back();
    }

    /**
     * A feladat idővonala (hozzászólások + státuszváltások) JSON-ban — a
     * feladat-modal nyitásakor töltjük, hogy a lista ne cipelje magával.
     */
    public function timeline(Request $request, Task $task): JsonResponse
    {
        $entries = $task->comments()->with('user:id,name')->get()
            ->map(fn (TaskComment $c) => $c->toTimelineArray($request->user()))
            ->values();

        return response()->json(['entries' => $entries]);
    }

    /** Új hozzászólás a feladathoz — a feladatot látó bármelyik felhasználótól. */
    public function storeComment(Request $request, Task $task): RedirectResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $task->comments()->create([
            'user_id' => $request->user()->id,
            'kind' => TaskComment::KIND_COMMENT,
            'body' => trim($data['body']),
        ]);

        return back(); // az idővonalat a modal tölti újra
    }

    /** Hozzászólás törlése: a saját bejegyzését bárki, másét a tasks.delete jog. */
    public function destroyComment(Request $request, TaskComment $comment): RedirectResponse
    {
        abort_unless($comment->canBeDeletedBy($request->user()), 403);

        $comment->delete();

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
