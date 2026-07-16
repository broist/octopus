<?php

namespace App\Http\Controllers;

use App\Http\Requests\DocumentRequest;
use App\Models\Document;
use App\Models\Partner;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $category = $request->string('category')->toString();
        $projectId = $request->integer('project');

        $documents = Document::query()
            ->when($category !== '', fn ($q) => $q->where('category', $category))
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($q) use ($search) {
                    $q->where('title', 'ilike', "%{$search}%")
                        ->orWhereHas('versions', fn ($v) => $v->where('original_filename', 'ilike', "%{$search}%"));
                });
            })
            ->with(['currentVersion', 'project:id,code,name', 'partner:id,name', 'uploader:id,name'])
            ->orderByDesc('updated_at')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Document $d) => $this->documentRow($d));

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'filters' => ['search' => $search, 'category' => $category, 'project' => $projectId ?: null],
            'categories' => Document::CATEGORIES,
            'projects' => $this->projectOptions(),
            'partners' => Partner::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(DocumentRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $file = $request->file('file');
        $disk = Document::diskForCategory($data['category']);

        $document = DB::transaction(function () use ($data, $file, $disk, $request) {
            $document = Document::create([
                ...collect($data)->except('file')->all(),
                'uploaded_by' => $request->user()->id,
            ]);

            $path = $file->store("doc-{$document->id}", $disk);

            $document->versions()->create([
                'version_number' => 1,
                'is_current' => true,
                'disk' => $disk,
                'file_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);

            return $document;
        });

        if ($document->project_id) {
            $document->project?->logActivity('dokumentum', "Dokumentum feltöltve: {$document->title}");
        }

        return redirect()
            ->route('documents.show', $document)
            ->with('success', 'A fájl feltöltve.');
    }

    public function show(Document $document): Response
    {
        $document->load([
            'versions.uploader:id,name',
            'project:id,code,name',
            'partner:id,name',
            'uploader:id,name',
        ]);

        $current = $document->versions->firstWhere('is_current', true);

        return Inertia::render('Documents/Show', [
            'document' => [
                'id' => $document->id,
                'title' => $document->title,
                'category' => $document->category,
                'description' => $document->description,
                'project' => $document->project
                    ? ['id' => $document->project->id, 'code' => $document->project->code, 'name' => $document->project->name]
                    : null,
                'partner_id' => $document->partner_id,
                'project_id' => $document->project_id,
                'partner' => $document->partner
                    ? ['id' => $document->partner->id, 'name' => $document->partner->name]
                    : null,
                'uploader_name' => $document->uploader?->name,
                'created_at' => $document->created_at->toIso8601String(),
                'preview_version_id' => $current?->isPreviewable() ? $current->id : null,
                'preview_mime' => $current?->mime_type,
            ],
            'versions' => $document->versions->map(fn ($v) => [
                'id' => $v->id,
                'version_number' => $v->version_number,
                'is_current' => $v->is_current,
                'original_filename' => $v->original_filename,
                'mime_type' => $v->mime_type,
                'size_bytes' => $v->size_bytes,
                'note' => $v->note,
                'uploader_name' => $v->uploader?->name,
                'created_at' => $v->created_at->toIso8601String(),
                'stored_in_cloud' => $v->disk === 'plans',
            ])->values(),
            'categories' => Document::CATEGORIES,
            'projects' => $this->projectOptions(),
            'partners' => Partner::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(DocumentRequest $request, Document $document): RedirectResponse
    {
        $document->update($request->validated());

        return back()->with('success', 'A dokumentum adatai elmentve.');
    }

    public function destroy(Document $document): RedirectResponse
    {
        $title = $document->title;
        $project = $document->project;

        $document->delete();

        $project?->logActivity('dokumentum', "Dokumentum törölve: {$title}");

        return redirect()
            ->route('documents.index')
            ->with('success', 'A dokumentum törölve.');
    }

    /**
     * @return array<int, array{id:int,label:string}>
     */
    private function projectOptions(): array
    {
        return Project::orderBy('code')
            ->get(['id', 'code', 'name'])
            ->map(fn ($p) => ['id' => $p->id, 'label' => "{$p->code} – {$p->name}"])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function documentRow(Document $d): array
    {
        $v = $d->currentVersion;

        return [
            'id' => $d->id,
            'title' => $d->title,
            'category' => $d->category,
            'project' => $d->project ? ['id' => $d->project->id, 'code' => $d->project->code] : null,
            'partner_name' => $d->partner?->name,
            'uploader_name' => $d->uploader?->name,
            'updated_at' => $d->updated_at->toIso8601String(),
            'version_number' => $v?->version_number ?? 0,
            'original_filename' => $v?->original_filename,
            'mime_type' => $v?->mime_type,
            'size_bytes' => $v?->size_bytes ?? 0,
            'download_version_id' => $v?->id,
        ];
    }
}
