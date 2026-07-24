<?php

namespace App\Http\Controllers;

use App\Http\Requests\DefectRequest;
use App\Models\Defect;
use App\Models\DefectPhoto;
use App\Models\Document;
use App\Models\Project;
use App\Models\SafetyRecord;
use App\Models\Task;
use App\Models\User;
use App\Support\Qa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Minőség / Munkavédelem (spec §12) — a hibalisták (fő nézet) és a munkavédelmi
 * nyilvántartás. Az ellenőrző-sablonokat és a checklist-kitöltést külön kontroller
 * kezeli (ChecklistTemplateController / InspectionController). A feltárt hiba egy
 * kattintással feladattá alakítható (kapcsolat a Feladatok modullal), a fotók a
 * Dokumentumtárba is bekerülnek.
 */
class QaController extends Controller
{
    // --- Hibalisták (fő nézet) -----------------------------------------------

    public function index(Request $request): Response
    {
        $projectId = $request->integer('project');
        $status = $request->string('status')->toString();
        $responsibleId = $request->integer('responsible');
        $mine = $request->boolean('mine');
        $userId = $request->user()->id;

        $defects = Defect::query()
            ->with(['project:id,code,name', 'responsible:id,name', 'task:id,status', 'inspection:id,title'])
            ->withCount('photos')
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->when($responsibleId > 0, fn ($q) => $q->where('responsible_user_id', $responsibleId))
            ->when($mine, fn ($q) => $q->where('responsible_user_id', $userId))
            ->status($status)
            ->orderByRaw("case status when 'nyitott' then 0 when 'javitas_alatt' then 1 else 2 end")
            ->orderByRaw('due_on asc nulls last')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Defect $d) => $this->defectSummary($d));

        $scoped = fn () => Defect::query()->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId));

        return Inertia::render('Qa/Index', [
            'defects' => $defects,
            'filters' => [
                'project' => $projectId ?: null,
                'status' => $status,
                'responsible' => $responsibleId ?: null,
                'mine' => $mine,
            ],
            'stats' => [
                'open' => $scoped()->where('status', 'nyitott')->count(),
                'in_progress' => $scoped()->where('status', 'javitas_alatt')->count(),
                'closed' => $scoped()->where('status', 'lezart')->count(),
                'overdue' => $scoped()->where('status', '!=', 'lezart')
                    ->whereNotNull('due_on')->whereDate('due_on', '<', today())->count(),
            ],
            ...$this->defectOptions(),
        ]);
    }

    public function storeDefect(DefectRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $defect = Defect::create([
            'project_id' => $data['project_id'],
            'inspection_id' => $data['inspection_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'severity' => $data['severity'],
            'status' => $data['status'],
            'responsible_user_id' => $data['responsible_user_id'] ?? null,
            'due_on' => $data['due_on'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        $this->storePhotos($request, $defect);
        $defect->project?->logActivity('hiba', "Új hiba rögzítve: {$defect->title}", $request->user());

        return back()->with('success', 'Hiba rögzítve.');
    }

    public function updateDefect(DefectRequest $request, Defect $defect): RedirectResponse
    {
        $data = $request->validated();
        $wasClosed = $defect->status === 'lezart';

        $defect->update([
            'project_id' => $data['project_id'],
            'inspection_id' => $data['inspection_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'severity' => $data['severity'],
            'status' => $data['status'],
            'responsible_user_id' => $data['responsible_user_id'] ?? null,
            'due_on' => $data['due_on'] ?? null,
        ]);

        foreach ($data['remove_photos'] ?? [] as $photoId) {
            $photo = $defect->photos()->whereKey($photoId)->first();
            if ($photo) {
                $this->deletePhoto($photo);
            }
        }
        $this->storePhotos($request, $defect);

        if (! $wasClosed && $defect->status === 'lezart') {
            $defect->project?->logActivity('hiba', "Hiba lezárva: {$defect->title}", $request->user());
        }

        return back()->with('success', 'Hiba módosítva.');
    }

    public function destroyDefect(Defect $defect): RedirectResponse
    {
        foreach ($defect->photos as $photo) {
            $this->deletePhoto($photo);
        }
        $defect->delete();

        return back()->with('success', 'Hiba törölve.');
    }

    /**
     * A feltárt hiba feladattá alakítása (spec §12: egy kattintással, felelős +
     * határidő). Ha már van hozzá feladat, arra irányítunk.
     */
    public function toTask(Request $request, Defect $defect): RedirectResponse
    {
        if ($defect->task_id) {
            return redirect()->route('tasks.index')->with('info', 'Ehhez a hibához már tartozik feladat.');
        }

        $priority = match ($defect->severity) {
            'magas' => 'magas',
            'alacsony' => 'alacsony',
            default => 'kozepes',
        };

        $task = Task::create([
            'title' => $defect->title,
            'description' => trim(($defect->description ? $defect->description."\n\n" : '')
                ."(Minőségi/munkavédelmi hibából — projekt: {$defect->project?->code})"),
            'project_id' => $defect->project_id,
            'status' => 'teendo',
            'priority' => $priority,
            'due_on' => $defect->due_on?->toDateString(),
            'created_by' => $request->user()->id,
        ]);

        if ($defect->responsible_user_id) {
            $task->assignees()->sync([$defect->responsible_user_id]);
        }

        $defect->update(['task_id' => $task->id]);
        $defect->project?->logActivity('feladat', "Hibából feladat lett: {$defect->title}", $request->user());

        return back()->with('success', 'A hibából feladat készült.');
    }

    public function defectPhoto(Request $request, DefectPhoto $photo): SymfonyResponse
    {
        abort_unless($request->user()->can('qa.view'), 403);

        $storage = Storage::disk($photo->disk);
        abort_unless($storage->exists($photo->file_path), 404, 'A fájl nem található.');

        if ($photo->disk === 'plans') {
            return redirect()->away($storage->temporaryUrl($photo->file_path, now()->addMinutes(10)));
        }

        return $storage->response($photo->file_path, $photo->original_filename);
    }

    // --- Munkavédelmi nyilvántartás -------------------------------------------

    public function safety(Request $request): Response
    {
        $type = $request->string('type')->toString();
        $projectId = $request->integer('project');

        $records = SafetyRecord::query()
            ->with(['project:id,code,name', 'creator:id,name'])
            ->when($type !== '', fn ($q) => $q->where('type', $type))
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (SafetyRecord $r) => [
                'id' => $r->id,
                'type' => $r->type,
                'type_label' => Qa::SAFETY_TYPES[$r->type] ?? $r->type,
                'occurred_on' => $r->occurred_on->toDateString(),
                'title' => $r->title,
                'description' => $r->description,
                'participants' => $r->participants,
                'project' => $r->project ? ['id' => $r->project->id, 'code' => $r->project->code, 'name' => $r->project->name] : null,
                'creator_name' => $r->creator?->name,
            ]);

        return Inertia::render('Qa/Safety', [
            'records' => $records,
            'filters' => ['type' => $type, 'project' => $projectId ?: null],
            'types' => Qa::SAFETY_TYPES,
            'projects' => $this->projectOptions(),
            'canManage' => $request->user()->can('qa.create'),
        ]);
    }

    public function storeSafety(Request $request): RedirectResponse
    {
        $record = SafetyRecord::create($this->validateSafety($request) + ['created_by' => $request->user()->id]);
        $record->project?->logActivity('munkavedelem', "Munkavédelmi bejegyzés: {$record->title}", $request->user());

        return back()->with('success', 'Munkavédelmi bejegyzés rögzítve.');
    }

    public function updateSafety(Request $request, SafetyRecord $safetyRecord): RedirectResponse
    {
        $safetyRecord->update($this->validateSafety($request));

        return back()->with('success', 'Munkavédelmi bejegyzés módosítva.');
    }

    public function destroySafety(SafetyRecord $safetyRecord): RedirectResponse
    {
        $safetyRecord->delete();

        return back()->with('success', 'Munkavédelmi bejegyzés törölve.');
    }

    // --- Segédfüggvények ------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    private function validateSafety(Request $request): array
    {
        return $request->validate([
            'project_id' => ['nullable', 'exists:projects,id'],
            'type' => ['required', Rule::in(array_keys(Qa::SAFETY_TYPES))],
            'occurred_on' => ['required', 'date'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'participants' => ['nullable', 'string', 'max:2000'],
        ], [
            'type.required' => 'Válasszon típust.',
            'occurred_on.required' => 'Adja meg a dátumot.',
            'title.required' => 'Adja meg a megnevezést.',
        ]);
    }

    private function storePhotos(Request $request, Defect $defect): void
    {
        foreach ($request->file('photos') ?? [] as $file) {
            $disk = Document::diskFor('foto', (int) $file->getSize());
            $path = $file->store("defect-{$defect->id}", $disk);
            $document = $this->mirrorToDocument($defect, $disk, $path, $file);

            $defect->photos()->create([
                'disk' => $disk,
                'file_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'document_id' => $document?->id,
                'uploaded_by' => $request->user()->id,
            ]);
        }
    }

    private function mirrorToDocument(Defect $defect, string $disk, string $path, $file): ?Document
    {
        $defect->loadMissing('project:id,code');
        $code = $defect->project?->code ?? 'projekt';

        $document = Document::create([
            'title' => "Hiba fotó – {$code} – {$defect->title}",
            'category' => 'foto',
            'folder_id' => null,
            'project_id' => $defect->project_id,
            'description' => 'Minőségi/munkavédelmi hibából mentett helyszíni fotó.',
            'uploaded_by' => $defect->created_by,
        ]);

        $document->versions()->create([
            'version_number' => 1,
            'is_current' => true,
            'disk' => $disk,
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'uploaded_by' => $defect->created_by,
        ]);

        return $document;
    }

    private function deletePhoto(DefectPhoto $photo): void
    {
        Storage::disk($photo->disk)->delete($photo->file_path);

        if ($photo->document_id) {
            $document = Document::withTrashed()->find($photo->document_id);
            $document?->versions()->delete();
            $document?->forceDelete();
        }

        $photo->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private function defectSummary(Defect $d): array
    {
        return [
            'id' => $d->id,
            'title' => $d->title,
            'description' => $d->description,
            'severity' => $d->severity,
            'severity_label' => Qa::SEVERITIES[$d->severity] ?? $d->severity,
            'status' => $d->status,
            'status_label' => Qa::DEFECT_STATUSES[$d->status] ?? $d->status,
            'project' => $d->project ? ['id' => $d->project->id, 'code' => $d->project->code, 'name' => $d->project->name] : null,
            'responsible_id' => $d->responsible_user_id,
            'responsible_name' => $d->responsible?->name,
            'due_on' => $d->due_on?->toDateString(),
            'is_overdue' => $d->isOverdue(),
            'inspection' => $d->inspection ? ['id' => $d->inspection->id, 'title' => $d->inspection->title] : null,
            'task_id' => $d->task_id,
            'task_status' => $d->task?->status,
            'photos_count' => (int) $d->photos_count,
            'photos' => $this->photoList($d),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function photoList(Defect $d): array
    {
        if (! $d->relationLoaded('photos')) {
            return [];
        }

        return $d->photos->map(fn (DefectPhoto $p) => [
            'id' => $p->id,
            'name' => $p->original_filename,
            'is_image' => $p->isImage(),
            'url' => route('qa.defect-photos.show', $p->id),
        ])->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function defectOptions(): array
    {
        return [
            'projects' => $this->projectOptions(),
            'users' => User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values(),
            'statuses' => Qa::DEFECT_STATUSES,
            'severities' => Qa::SEVERITIES,
        ];
    }

    /**
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function projectOptions()
    {
        return Project::orderBy('code')->get(['id', 'code', 'name'])
            ->map(fn (Project $p) => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name])->values();
    }
}
