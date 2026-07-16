<?php

namespace App\Http\Controllers;

use App\Http\Requests\DocumentRequest;
use App\Models\Document;
use App\Models\Folder;
use App\Models\Partner;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    /**
     * Explorer nézet: az aktuális mappa tartalma, vagy szűrt (lapos) találati
     * lista, ha keresés/szűrő aktív.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $search = $request->string('search')->toString();
        $category = $request->string('category')->toString();
        $projectId = $request->integer('project');
        $searchMode = $search !== '' || $category !== '' || $projectId > 0;

        $folder = null;
        if ($request->filled('folder')) {
            $folder = Folder::findOrFail($request->integer('folder'));
            abort_unless($folder->isVisibleTo($user), 403);
        }

        $visibleIds = Folder::visibleIdsFor($user);
        $accessMap = Folder::accessMapFor($user);

        // Mappa-fa a bal oldali navigációhoz és a mozgatás-választóhoz.
        $tree = Folder::query()
            ->whereIn('id', $visibleIds)
            ->orderBy('name')
            ->get(['id', 'name', 'parent_id', 'is_restricted'])
            ->map(fn ($f) => [
                'id' => $f->id,
                'name' => $f->name,
                'parent_id' => $f->parent_id,
                'is_restricted' => $f->is_restricted,
                'can_edit' => ($accessMap[$f->id] ?? null) === 'edit'
                    || (($accessMap[$f->id] ?? null) === null && $user->can('documents.edit')),
            ])->values();

        // Almappák (csak mappa-nézetben).
        $folders = collect();
        if (! $searchMode) {
            $folders = Folder::query()
                ->where('parent_id', $folder?->id)
                ->whereIn('id', $visibleIds)
                ->withCount(['children', 'documents'])
                ->with('users:id,name')
                ->orderBy('name')
                ->get()
                ->map(fn (Folder $f) => [
                    'id' => $f->id,
                    'name' => $f->name,
                    'is_restricted' => $f->is_restricted,
                    'items_count' => $f->children_count + $f->documents_count,
                    'updated_at' => $f->updated_at->toIso8601String(),
                    'acl' => $f->users->map(fn ($u) => [
                        'user_id' => $u->id,
                        'access' => $u->pivot->access,
                    ])->values(),
                    'can_manage_permissions' => $f->canManagePermissions($user),
                ])->values();
        }

        // Fájlok: mappa-nézetben az aktuális mappa; keresésnél lapos lista.
        $folderPaths = null;
        $documents = Document::query()
            ->visibleTo($user)
            ->when(! $searchMode, fn ($q) => $q->where('folder_id', $folder?->id))
            ->when($searchMode && $category !== '', fn ($q) => $q->where('category', $category))
            ->when($searchMode && $projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->when($searchMode && $search !== '', function ($q) use ($search) {
                $q->where(function ($q) use ($search) {
                    $q->where('title', 'ilike', "%{$search}%")
                        ->orWhereHas('versions', fn ($v) => $v->where('original_filename', 'ilike', "%{$search}%"));
                });
            })
            ->with(['currentVersion', 'project:id,code', 'folder'])
            ->orderBy('title')
            ->limit($searchMode ? 100 : 500)
            ->get()
            ->map(function (Document $d) use ($searchMode, &$folderPaths) {
                $v = $d->currentVersion;

                return [
                    'id' => $d->id,
                    'title' => $d->title,
                    'category' => $d->category,
                    'original_filename' => $v?->original_filename,
                    'mime_type' => $v?->mime_type,
                    'size_bytes' => $v?->size_bytes ?? 0,
                    'version_number' => $v?->version_number ?? 0,
                    'updated_at' => $d->updated_at->toIso8601String(),
                    'download_version_id' => $v?->id,
                    'preview_version_id' => $v?->isPreviewable() ? $v->id : null,
                    'is_image' => str_starts_with((string) $v?->mime_type, 'image/'),
                    'project_code' => $d->project?->code,
                    'location' => $searchMode
                        ? ($d->folder?->pathString() ?? 'Fájlok')
                        : null,
                ];
            });

        return Inertia::render('Documents/Index', [
            'folderId' => $folder?->id,
            'breadcrumbs' => $folder ? $folder->breadcrumbs() : [['id' => null, 'name' => 'Fájlok']],
            'folders' => $folders,
            'documents' => $documents,
            'tree' => $tree,
            'can' => [
                'create' => Folder::canCreateIn($user, $folder),
                'edit' => Folder::canEditIn($user, $folder),
                'delete' => Folder::canDeleteIn($user, $folder),
                'manage_permissions' => $folder ? $folder->canManagePermissions($user) : $user->hasRole('IT Admin'),
            ],
            'currentFolder' => $folder ? [
                'id' => $folder->id,
                'name' => $folder->name,
                'is_restricted' => $folder->is_restricted,
                'acl' => $folder->users()->get(['users.id'])->map(fn ($u) => [
                    'user_id' => $u->id,
                    'access' => $u->pivot->access,
                ])->values(),
            ] : null,
            'users' => \App\Models\User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name']),
            'categories' => Document::CATEGORIES,
            'projects' => $this->projectOptions(),
            'filters' => ['search' => $search, 'category' => $category, 'project' => $projectId ?: null],
            'searchMode' => $searchMode,
        ]);
    }

    /**
     * Feltöltés: egy vagy több fájl az aktuális mappába (mobilon galéria /
     * kamera forrásból is).
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:20'],
            'files.*' => [
                'file',
                'max:'.DocumentRequest::MAX_KB,
                'extensions:'.DocumentRequest::EXTENSIONS,
            ],
            'folder_id' => ['nullable', 'integer', 'exists:folders,id'],
            'category' => ['nullable', \Illuminate\Validation\Rule::in(array_keys(Document::CATEGORIES))],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
        ], [
            'files.required' => 'Válasszon ki legalább egy fájlt.',
            'files.max' => 'Egyszerre legfeljebb 20 fájl tölthető fel.',
            'files.*.max' => 'Valamelyik fájl túl nagy (legfeljebb 120 MB lehet).',
            'files.*.extensions' => 'Valamelyik fájl típusa nem engedélyezett.',
        ]);

        $folder = isset($data['folder_id']) ? Folder::findOrFail($data['folder_id']) : null;
        abort_unless(Folder::canCreateIn($user, $folder), 403);

        $count = 0;
        DB::transaction(function () use ($data, $folder, $user, $request, &$count) {
            foreach ($request->file('files') as $file) {
                $mime = $file->getMimeType() ?? '';
                $category = $data['category']
                    ?: (str_starts_with($mime, 'image/') ? 'foto' : 'egyeb');
                $disk = Document::diskForCategory($category);

                $document = Document::create([
                    'title' => Str::limit(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME), 190, ''),
                    'category' => $category,
                    'folder_id' => $folder?->id,
                    'project_id' => $data['project_id'] ?? null,
                    'uploaded_by' => $user->id,
                ]);

                $path = $file->store("doc-{$document->id}", $disk);

                $document->versions()->create([
                    'version_number' => 1,
                    'is_current' => true,
                    'disk' => $disk,
                    'file_path' => $path,
                    'original_filename' => $file->getClientOriginalName(),
                    'mime_type' => $mime,
                    'size_bytes' => $file->getSize(),
                    'uploaded_by' => $user->id,
                ]);

                $document->project?->logActivity('dokumentum', "Dokumentum feltöltve: {$document->title}");
                $count++;
            }
        });

        return back()->with('success', $count === 1
            ? 'A fájl feltöltve.'
            : "{$count} fájl feltöltve.");
    }

    public function show(Request $request, Document $document): Response
    {
        abort_unless($document->isVisibleTo($request->user()), 404);

        $document->load([
            'versions.uploader:id,name',
            'project:id,code,name',
            'partner:id,name',
            'uploader:id,name',
            'folder',
        ]);

        $current = $document->versions->firstWhere('is_current', true);

        return Inertia::render('Documents/Show', [
            'document' => [
                'id' => $document->id,
                'title' => $document->title,
                'category' => $document->category,
                'description' => $document->description,
                'folder_id' => $document->folder_id,
                'folder_path' => $document->folder?->pathString() ?? 'Fájlok',
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
        abort_unless($document->isVisibleTo($request->user()), 404);
        abort_unless(Folder::canEditIn($request->user(), $document->folder), 403);

        $document->update($request->validated());

        return back()->with('success', 'A dokumentum adatai elmentve.');
    }

    /**
     * Fájl áthelyezése másik mappába.
     */
    public function move(Request $request, Document $document): RedirectResponse
    {
        abort_unless($document->isVisibleTo($request->user()), 404);

        $data = $request->validate([
            'folder_id' => ['nullable', 'integer', 'exists:folders,id'],
        ]);

        $target = isset($data['folder_id']) ? Folder::findOrFail($data['folder_id']) : null;

        abort_unless(Folder::canEditIn($request->user(), $document->folder), 403);
        abort_unless(Folder::canCreateIn($request->user(), $target), 403);

        $document->update(['folder_id' => $target?->id]);

        return back()->with('success', 'A fájl áthelyezve.');
    }

    public function destroy(Request $request, Document $document): RedirectResponse
    {
        abort_unless($document->isVisibleTo($request->user()), 404);
        abort_unless(Folder::canDeleteIn($request->user(), $document->folder), 403);

        $title = $document->title;
        $project = $document->project;
        $folderId = $document->folder_id;

        $document->delete();

        $project?->logActivity('dokumentum', "Dokumentum törölve: {$title}");

        // Explorerből (index) hívva maradunk a mappában; adatlapról vissza a mappába.
        if ($request->header('X-Inertia') && str_contains((string) $request->header('Referer'), '/documents/')) {
            return redirect()->route('documents.index', $folderId ? ['folder' => $folderId] : [])
                ->with('success', 'A dokumentum törölve.');
        }

        return back()->with('success', 'A dokumentum törölve.');
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
}
