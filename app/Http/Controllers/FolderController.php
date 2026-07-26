<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use App\Support\FolderTemplates;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FolderController extends Controller
{
    /**
     * Új mappa a megadott szülő alatt (null = gyökér).
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'parent_id' => ['nullable', 'integer', 'exists:folders,id'],
        ], [
            'name.required' => 'A mappa neve kötelező.',
            'name.max' => 'A mappa neve legfeljebb 120 karakter lehet.',
        ]);

        $parent = isset($data['parent_id']) ? Folder::findOrFail($data['parent_id']) : null;

        abort_unless(Folder::canCreateIn($request->user(), $parent), 403);
        $this->ensureUniqueName($data['name'], $parent?->id);

        Folder::create([
            'name' => $data['name'],
            'parent_id' => $parent?->id,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'A mappa létrejött.');
    }

    /**
     * Kész mappastruktúra létrehozása sablonból (spec §10).
     *
     * Újra és újra futtatható: a már meglévő mappákat nem duplikálja, csak a
     * hiányzókat pótolja — így egy félkész struktúra utólag is kiegészíthető.
     */
    public function applyTemplate(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'template' => ['required', 'string'],
            'parent_id' => ['nullable', 'integer', 'exists:folders,id'],
            'name' => ['nullable', 'string', 'max:120'],
        ], [
            'template.required' => 'Válasszon sablont.',
        ]);

        abort_unless(FolderTemplates::exists($data['template']), 404);

        $template = FolderTemplates::get($data['template']);
        $parent = isset($data['parent_id']) ? Folder::findOrFail($data['parent_id']) : null;

        abort_unless(Folder::canCreateIn($request->user(), $parent), 403);

        // A gyökeret igénylő sablonoknál (projekt, dolgozó, alvállalkozó…) a
        // megadott név lesz a befoglaló mappa; enélkül a sablon alapértelmezése.
        $rootName = trim((string) ($data['name'] ?? ''));
        if ($template['root'] !== null && $rootName === '') {
            $rootName = FolderTemplates::placeholders($template['root']);
        }

        $created = 0;
        $existing = 0;
        $userId = $request->user()->id;

        DB::transaction(function () use ($template, $parent, $rootName, $userId, &$created, &$existing) {
            $target = $parent;

            if ($template['root'] !== null) {
                $target = $this->findOrCreate($rootName, $parent?->id, $userId, $created, $existing);
            }

            $this->createTree(
                FolderTemplates::resolve($template['tree']),
                $target?->id,
                $userId,
                $created,
                $existing,
            );
        });

        $message = $created > 0
            ? "A(z) „{$template['label']}” létrehozva: {$created} új mappa"
                .($existing > 0 ? ", {$existing} már létezett." : '.')
            : 'Minden mappa már létezett — nem jött létre új.';

        return back()->with($created > 0 ? 'success' : 'info', $message);
    }

    /**
     * Átnevezés.
     */
    public function update(Request $request, Folder $folder): RedirectResponse
    {
        abort_unless($folder->isVisibleTo($request->user()), 404);
        abort_unless(Folder::canEditIn($request->user(), $folder), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ], [
            'name.required' => 'A mappa neve kötelező.',
        ]);

        $this->ensureUniqueName($data['name'], $folder->parent_id, $folder->id);

        $folder->update(['name' => $data['name']]);

        return back()->with('success', 'A mappa átnevezve.');
    }

    /**
     * Áthelyezés másik mappába (kör-védelemmel).
     */
    public function move(Request $request, Folder $folder): RedirectResponse
    {
        abort_unless($folder->isVisibleTo($request->user()), 404);

        $data = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:folders,id'],
        ]);

        $target = isset($data['parent_id']) ? Folder::findOrFail($data['parent_id']) : null;

        if ($target && ($target->id === $folder->id || $target->isDescendantOf($folder))) {
            return back()->with('error', 'A mappa nem helyezhető át saját magába vagy almappájába.');
        }

        abort_unless(Folder::canEditIn($request->user(), $folder), 403);
        abort_unless(Folder::canCreateIn($request->user(), $target), 403);

        $this->ensureUniqueName($folder->name, $target?->id, $folder->id);

        $folder->update(['parent_id' => $target?->id]);

        return back()->with('success', 'A mappa áthelyezve.');
    }

    /**
     * Jogosultságok: korlátozás be/ki + felhasználónkénti szintek.
     */
    public function permissions(Request $request, Folder $folder): RedirectResponse
    {
        abort_unless($folder->isVisibleTo($request->user()), 404);
        abort_unless($folder->canManagePermissions($request->user()), 403);

        $data = $request->validate([
            'is_restricted' => ['required', 'boolean'],
            'entries' => ['array'],
            'entries.*.user_id' => ['required', 'integer', 'exists:users,id'],
            'entries.*.access' => ['required', Rule::in(['view', 'edit'])],
        ]);

        $sync = collect($data['entries'] ?? [])
            ->mapWithKeys(fn ($e) => [(int) $e['user_id'] => ['access' => $e['access']]]);

        // A beállítást végző ne zárhassa ki magát: korlátozáskor automatikusan
        // 'edit' szintet kap, ha nem szerepel a listában.
        if ($data['is_restricted'] && ! $request->user()->hasRole('IT Admin') && ! $sync->has($request->user()->id)) {
            $sync->put($request->user()->id, ['access' => 'edit']);
        }

        $folder->update(['is_restricted' => $data['is_restricted']]);
        $folder->users()->sync($data['is_restricted'] ? $sync->all() : []);

        return back()->with('success', $data['is_restricted']
            ? 'A mappa hozzáférése korlátozva a kiválasztott felhasználókra.'
            : 'A mappa korlátozása feloldva.');
    }

    /**
     * Törlés — csak üres mappa törölhető (védelem a véletlen adatvesztés ellen).
     */
    public function destroy(Request $request, Folder $folder): RedirectResponse
    {
        abort_unless($folder->isVisibleTo($request->user()), 404);
        abort_unless(Folder::canDeleteIn($request->user(), $folder), 403);

        if ($folder->children()->exists() || $folder->documents()->exists()) {
            return back()->with('error', 'A mappa nem üres — előbb helyezze át vagy törölje a tartalmát.');
        }

        $folder->users()->detach();
        $folder->delete();

        return back()->with('success', 'A mappa törölve.');
    }

    /**
     * A sablon fájának rekurzív létrehozása a megadott szülő alá.
     *
     * @param  array<string, mixed>  $tree
     */
    private function createTree(array $tree, ?int $parentId, int $userId, int &$created, int &$existing): void
    {
        foreach ($tree as $name => $children) {
            $folder = $this->findOrCreate((string) $name, $parentId, $userId, $created, $existing);
            $this->createTree((array) $children, $folder->id, $userId, $created, $existing);
        }
    }

    /**
     * Meglévő mappa keresése (kis-nagybetű független) vagy létrehozása.
     */
    private function findOrCreate(string $name, ?int $parentId, int $userId, int &$created, int &$existing): Folder
    {
        $folder = Folder::query()
            ->where('parent_id', $parentId)
            ->whereRaw('lower(name) = lower(?)', [$name])
            ->first();

        if ($folder) {
            $existing++;

            return $folder;
        }

        $created++;

        return Folder::create([
            'name' => $name,
            'parent_id' => $parentId,
            'created_by' => $userId,
        ]);
    }

    private function ensureUniqueName(string $name, ?int $parentId, ?int $exceptId = null): void
    {
        $exists = Folder::query()
            ->where('parent_id', $parentId)
            ->whereRaw('lower(name) = lower(?)', [$name])
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->exists();

        if ($exists) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'name' => 'Ilyen nevű mappa már létezik itt.',
            ]);
        }
    }
}
