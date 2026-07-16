<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
