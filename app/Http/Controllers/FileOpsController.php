<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Fájlkezelő „Windows Intéző” műveletek.
 *
 * Két dolgot ad a modulhoz, amit az elem-alapú (egy mappa / egy fájl)
 * kontrollerek nem tudnak:
 *  - Tulajdonságok adatlap (JSON, igény szerint lekérve) — rekurzív méret,
 *    tulajdonos, öröklött jogosultságok;
 *  - Tömeges műveletek (törlés / áthelyezés / másolás) a többkijelöléshez és a
 *    kivágás–másolás–beillesztés vágólaphoz.
 */
class FileOpsController extends Controller
{
    /** Egy másolás/áthelyezés során feldolgozható elemek felső korlátja. */
    private const MAX_ITEMS = 2000;

    /* ------------------------------------------------------------------ */
    /* Tulajdonságok */
    /* ------------------------------------------------------------------ */

    public function properties(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['folder', 'file'])],
            'id' => ['required', 'integer'],
        ]);

        return response()->json(
            $data['type'] === 'folder'
                ? $this->folderProperties($request, Folder::findOrFail($data['id']))
                : $this->documentProperties($request, Document::findOrFail($data['id']))
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function folderProperties(Request $request, Folder $folder): array
    {
        $user = $request->user();
        abort_unless($folder->isVisibleTo($user), 404);

        $folder->load('creator:id,name');

        // Rekurzív tartalom — csak a felhasználó által látható ágakon.
        $descendants = $this->descendantIds($folder, Folder::visibleIdsFor($user));
        $scope = array_merge([$folder->id], $descendants);

        $documentIds = Document::whereIn('folder_id', $scope)->pluck('id');
        $sizeBytes = (int) DocumentVersion::whereIn('document_id', $documentIds)
            ->where('is_current', true)
            ->sum('size_bytes');

        // A legközelebbi korlátozott ős — a mappa a saját beállítása nélkül is
        // örökölhet korlátozást (a Folder::accessMapFor lefelé örökít).
        $inheritedFrom = null;
        foreach ($folder->ancestors() as $ancestor) {
            if ($ancestor->is_restricted) {
                $inheritedFrom = $ancestor;
                break;
            }
        }

        return [
            'type' => 'folder',
            'id' => $folder->id,
            'name' => $folder->name,
            'path' => $folder->pathString(),
            'parent_id' => $folder->parent_id,
            'created_at' => $folder->created_at?->toIso8601String(),
            'updated_at' => $folder->updated_at?->toIso8601String(),
            'owner' => $folder->creator?->name,
            'folder_count' => count($descendants),
            'file_count' => $documentIds->count(),
            'size_bytes' => $sizeBytes,
            'is_restricted' => $folder->is_restricted,
            'access_level' => $folder->accessFor($user),
            'can_manage_permissions' => $folder->canManagePermissions($user),
            'can_edit' => Folder::canEditIn($user, $folder),
            'acl' => $this->aclOf($folder),
            'inherited_from' => $inheritedFrom
                ? ['id' => $inheritedFrom->id, 'name' => $inheritedFrom->name, 'acl' => $this->aclOf($inheritedFrom)]
                : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function documentProperties(Request $request, Document $document): array
    {
        $user = $request->user();
        abort_unless($document->isVisibleTo($user), 404);

        $document->load(['currentVersion', 'uploader:id,name', 'folder', 'project:id,code,name', 'partner:id,name']);
        $version = $document->currentVersion;

        return [
            'type' => 'file',
            'id' => $document->id,
            'name' => $document->title,
            'path' => $document->folder?->pathString() ?? 'Fájlok',
            'folder_id' => $document->folder_id,
            'filename' => $version?->original_filename,
            'mime_type' => $version?->mime_type,
            'size_bytes' => (int) ($version?->size_bytes ?? 0),
            'category' => $document->category,
            'category_label' => Document::CATEGORIES[$document->category] ?? $document->category,
            'description' => $document->description,
            'version_number' => $version?->version_number ?? 0,
            'version_count' => $document->versions()->count(),
            'created_at' => $document->created_at?->toIso8601String(),
            'updated_at' => $document->updated_at?->toIso8601String(),
            'owner' => $document->uploader?->name,
            'project' => $document->project
                ? "{$document->project->code} – {$document->project->name}"
                : null,
            'partner' => $document->partner?->name,
            'stored_in_cloud' => $version?->disk === 'plans',
            'download_version_id' => $version?->id,
            'can_edit' => Folder::canEditIn($user, $document->folder),
            'can_delete' => Folder::canDeleteIn($user, $document->folder),
            // A fájl jogosultságait a befoglaló mappa dönti el (öröklődés).
            'folder' => $document->folder ? [
                'id' => $document->folder->id,
                'name' => $document->folder->name,
                'is_restricted' => $document->folder->is_restricted,
                'can_manage_permissions' => $document->folder->canManagePermissions($user),
            ] : null,
        ];
    }

    /**
     * @return array<int, array{user_id:int,name:string,access:string}>
     */
    private function aclOf(Folder $folder): array
    {
        return $folder->users()
            ->orderBy('users.name')
            ->get(['users.id', 'users.name'])
            ->map(fn ($u) => [
                'user_id' => $u->id,
                'name' => $u->name,
                'access' => $u->pivot->access,
            ])->all();
    }

    /* ------------------------------------------------------------------ */
    /* Tömeges műveletek (többkijelölés + vágólap) */
    /* ------------------------------------------------------------------ */

    public function bulk(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'action' => ['required', Rule::in(['delete', 'move', 'copy'])],
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*.type' => ['required', Rule::in(['folder', 'file'])],
            'items.*.id' => ['required', 'integer'],
            'target_id' => ['nullable', 'integer', 'exists:folders,id'],
            // Nem üres mappa törlése a teljes tartalmával (a felület külön kérdez rá).
            'recursive' => ['boolean'],
        ]);

        $target = isset($data['target_id']) ? Folder::findOrFail($data['target_id']) : null;
        if ($data['action'] !== 'delete') {
            abort_unless($target === null || $target->isVisibleTo($user), 404);
            abort_unless(Folder::canCreateIn($user, $target), 403);
        }

        $done = 0;
        $skipped = [];

        DB::transaction(function () use ($data, $target, $user, &$done, &$skipped) {
            foreach ($data['items'] as $item) {
                $model = $item['type'] === 'folder'
                    ? Folder::find($item['id'])
                    : Document::find($item['id']);

                if (! $model || ! $model->isVisibleTo($user)) {
                    continue;
                }

                match ($data['action']) {
                    'delete' => $this->deleteItem($model, $user, (bool) ($data['recursive'] ?? false), $done, $skipped),
                    'move' => $this->moveItem($model, $target, $user, $done, $skipped),
                    'copy' => $this->copyItem($model, $target, $user, $done, $skipped),
                };
            }
        });

        $noun = match ($data['action']) {
            'delete' => 'törölve',
            'move' => 'áthelyezve',
            'copy' => 'másolva',
        };

        if ($done === 0) {
            return back()->with('error', $skipped
                ? implode(' ', $skipped)
                : 'Nem sikerült a művelet.');
        }

        $message = "{$done} elem {$noun}.";
        if ($skipped) {
            $message .= ' '.implode(' ', array_slice($skipped, 0, 3));
        }

        return back()->with($skipped ? 'info' : 'success', $message);
    }

    /* ------------------------------------------------------------------ */

    /**
     * @param  Folder|Document  $model
     * @param  array<int, string>  $skipped
     */
    private function deleteItem($model, User $user, bool $recursive, int &$done, array &$skipped): void
    {
        if ($model instanceof Document) {
            if (! Folder::canDeleteIn($user, $model->folder)) {
                $skipped[] = "Nincs jogosultság: „{$model->title}”.";

                return;
            }

            $project = $model->project;
            $title = $model->title;
            $model->delete();
            $project?->logActivity('dokumentum', "Dokumentum törölve: {$title}");
            $done++;

            return;
        }

        if (! Folder::canDeleteIn($user, $model)) {
            $skipped[] = "Nincs jogosultság: „{$model->name}”.";

            return;
        }

        $isEmpty = ! $model->children()->exists() && ! $model->documents()->exists();

        if (! $isEmpty && ! $recursive) {
            $skipped[] = "A(z) „{$model->name}” mappa nem üres.";

            return;
        }

        $ids = array_merge([$model->id], $this->descendantIds($model, null));

        // Nem törölhet olyan ágat, amelynek van előle REJTETT (korlátozott)
        // almappája — különben a jogosultság nélküli tartalom is elveszne.
        $hidden = array_diff($ids, Folder::visibleIdsFor($user));
        if ($hidden !== []) {
            $skipped[] = "A(z) „{$model->name}” mappa korlátozott almappát tartalmaz — nem törölhető.";

            return;
        }

        Document::whereIn('folder_id', $ids)->get()->each->delete();
        DB::table('folder_user')->whereIn('folder_id', $ids)->delete();
        Folder::whereIn('id', $ids)->get()->each->delete();

        $done++;
    }

    /**
     * @param  Folder|Document  $model
     * @param  array<int, string>  $skipped
     */
    private function moveItem($model, ?Folder $target, User $user, int &$done, array &$skipped): void
    {
        if ($model instanceof Document) {
            if (! Folder::canEditIn($user, $model->folder)) {
                $skipped[] = "Nincs jogosultság: „{$model->title}”.";

                return;
            }

            $model->update(['folder_id' => $target?->id]);
            $done++;

            return;
        }

        if (! Folder::canEditIn($user, $model)) {
            $skipped[] = "Nincs jogosultság: „{$model->name}”.";

            return;
        }

        if ($target && ($target->id === $model->id || $target->isDescendantOf($model))) {
            $skipped[] = "A(z) „{$model->name}” nem helyezhető saját almappájába.";

            return;
        }

        if ($model->parent_id === $target?->id) {
            return; // már ott van
        }

        if ($this->nameTaken($model->name, $target?->id, $model->id)) {
            $skipped[] = "Már van „{$model->name}” nevű mappa a célhelyen.";

            return;
        }

        $model->update(['parent_id' => $target?->id]);
        $done++;
    }

    /**
     * @param  Folder|Document  $model
     * @param  array<int, string>  $skipped
     */
    private function copyItem($model, ?Folder $target, User $user, int &$done, array &$skipped): void
    {
        if ($model instanceof Document) {
            // Ugyanabba a mappába másolva a Windowshoz hasonlóan „– másolat” utótag.
            $this->copyDocument($model, $target?->id, $user, $model->folder_id === $target?->id);
            $done++;

            return;
        }

        if ($target && ($target->id === $model->id || $target->isDescendantOf($model))) {
            $skipped[] = "A(z) „{$model->name}” nem másolható saját almappájába.";

            return;
        }

        $count = 1 + count($this->descendantIds($model, null));
        if ($count > self::MAX_ITEMS) {
            $skipped[] = "A(z) „{$model->name}” túl nagy a másoláshoz ({$count} mappa).";

            return;
        }

        $this->copyFolder($model, $target?->id, $user);
        $done++;
    }

    /**
     * Mappa rekurzív másolása (almappákkal és fájlokkal együtt).
     */
    private function copyFolder(Folder $source, ?int $parentId, User $user): Folder
    {
        $copy = Folder::create([
            'name' => $this->uniqueName($source->name, $parentId),
            'parent_id' => $parentId,
            'is_restricted' => $source->is_restricted,
            'created_by' => $user->id,
        ]);

        if ($source->is_restricted) {
            $copy->users()->sync(
                $source->users->mapWithKeys(fn ($u) => [$u->id => ['access' => $u->pivot->access]])->all()
            );
        }

        foreach ($source->documents()->get() as $document) {
            $this->copyDocument($document, $copy->id, $user, false);
        }

        foreach ($source->children()->get() as $child) {
            $this->copyFolder($child, $copy->id, $user);
        }

        return $copy;
    }

    /**
     * Fájl másolása: új dokumentum az AKTUÁLIS verzió tartalmával (v1-ként).
     */
    private function copyDocument(Document $source, ?int $folderId, User $user, bool $suffix): Document
    {
        $version = $source->currentVersion;

        $copy = Document::create([
            'title' => $suffix ? "{$source->title} – másolat" : $source->title,
            'category' => $source->category,
            'folder_id' => $folderId,
            'project_id' => $source->project_id,
            'partner_id' => $source->partner_id,
            'description' => $source->description,
            'uploaded_by' => $user->id,
        ]);

        if ($version) {
            $ext = pathinfo((string) $version->file_path, PATHINFO_EXTENSION);
            $path = "doc-{$copy->id}/".Str::random(40).($ext !== '' ? ".{$ext}" : '');

            $disk = Storage::disk($version->disk);
            if ($disk->exists($version->file_path)) {
                $disk->copy($version->file_path, $path);
            }

            $copy->versions()->create([
                'version_number' => 1,
                'is_current' => true,
                'disk' => $version->disk,
                'file_path' => $path,
                'original_filename' => $version->original_filename,
                'mime_type' => $version->mime_type,
                'size_bytes' => $version->size_bytes,
                'uploaded_by' => $user->id,
            ]);
        }

        return $copy;
    }

    /* ------------------------------------------------------------------ */
    /* Segédek */
    /* ------------------------------------------------------------------ */

    /**
     * A mappa összes leszármazottjának azonosítója.
     *
     * @param  array<int, int>|null  $limitTo  csak ezekre szűkítve (láthatóság)
     * @return array<int, int>
     */
    private function descendantIds(Folder $folder, ?array $limitTo): array
    {
        $rows = Folder::query()
            ->when($limitTo !== null, fn ($q) => $q->whereIn('id', $limitTo))
            ->get(['id', 'parent_id']);

        $byParent = [];
        foreach ($rows as $row) {
            $byParent[$row->parent_id][] = $row->id;
        }

        $result = [];
        $queue = $byParent[$folder->id] ?? [];
        while ($queue) {
            $id = array_pop($queue);
            $result[] = $id;
            foreach ($byParent[$id] ?? [] as $child) {
                $queue[] = $child;
            }
        }

        return $result;
    }

    private function nameTaken(string $name, ?int $parentId, ?int $exceptId = null): bool
    {
        return Folder::query()
            ->where('parent_id', $parentId)
            ->whereRaw('lower(name) = lower(?)', [$name])
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->exists();
    }

    /**
     * Ütközésmentes mappanév a célhelyen („X”, „X – másolat”, „X – másolat (2)”…).
     */
    private function uniqueName(string $name, ?int $parentId): string
    {
        if (! $this->nameTaken($name, $parentId)) {
            return $name;
        }

        $candidate = "{$name} – másolat";
        $i = 2;
        while ($this->nameTaken($candidate, $parentId)) {
            $candidate = "{$name} – másolat ({$i})";
            $i++;
        }

        return Str::limit($candidate, 120, '');
    }
}
