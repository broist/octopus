<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Fájlkezelő mappa.
 *
 * Hozzáférési modell:
 *  - A nem korlátozott mappákra a modul-jogosultságok érvényesek
 *    (documents.view/create/edit/delete).
 *  - A korlátozott (is_restricted) mappát csak a folder_user-ben felsorolt
 *    felhasználók és az IT Admin látja. A korlátozás LEFELÉ öröklődik, és a
 *    szint csak szűkülhet: 'view' szülő alatt az 'edit' engedély is 'view'.
 *
 * A feloldott szint jelentése:
 *  - 'edit'  → teljes kezelés a mappán belül (ACL felülírja a modul-jogokat)
 *  - 'view'  → csak megtekintés/letöltés
 *  - null    → nincs érintett korlátozás; a modul-jogosultságok döntenek
 *  - false   → nincs hozzáférés (a mappa nem is látszik)
 */
class Folder extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'parent_id',
        'is_restricted',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_restricted' => 'boolean',
        ];
    }

    /** Kérésenkénti cache: [userId => [folderId => 'edit'|'view'|null|false]] */
    protected static array $accessCache = [];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('name');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot('access');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /* ------------------------------------------------------------------ */
    /* Hozzáférés-feloldás                                                  */
    /* ------------------------------------------------------------------ */

    /**
     * Teljes hozzáférési térkép a felhasználóhoz (egyszer számolva kérésenként).
     *
     * @return array<int, 'edit'|'view'|null|false>
     */
    public static function accessMapFor(User $user): array
    {
        if (isset(self::$accessCache[$user->id])) {
            return self::$accessCache[$user->id];
        }

        $folders = self::query()->with('users:id')->get()->keyBy('id');
        $isAdmin = $user->hasRole('IT Admin');
        $map = [];

        $resolve = function (int $id) use (&$resolve, &$map, $folders, $user, $isAdmin) {
            if (array_key_exists($id, $map)) {
                return $map[$id];
            }

            $folder = $folders->get($id);
            if (! $folder) {
                return $map[$id] = false;
            }

            // Szülő szintje (a gyökér: nincs korlátozás).
            $parentLevel = $folder->parent_id ? $resolve($folder->parent_id) : null;

            if ($parentLevel === false) {
                return $map[$id] = false;
            }

            if (! $folder->is_restricted) {
                return $map[$id] = $parentLevel;
            }

            if ($isAdmin) {
                return $map[$id] = ($parentLevel === 'view') ? 'view' : 'edit';
            }

            $grant = $folder->users->firstWhere('id', $user->id)?->pivot?->access;
            if (! $grant) {
                return $map[$id] = false;
            }

            // Szűkítés: a szülőnél kapott szintnél tágabb nem lehet.
            $level = ($parentLevel === 'view' || $grant === 'view') ? 'view' : 'edit';

            return $map[$id] = $level;
        };

        foreach ($folders->keys() as $id) {
            $resolve($id);
        }

        return self::$accessCache[$user->id] = $map;
    }

    /**
     * A felhasználó által látható mappa-azonosítók.
     *
     * @return array<int, int>
     */
    public static function visibleIdsFor(User $user): array
    {
        return array_keys(array_filter(
            self::accessMapFor($user),
            fn ($level) => $level !== false,
        ));
    }

    /**
     * @return 'edit'|'view'|null|false
     */
    public function accessFor(User $user): string|false|null
    {
        $map = self::accessMapFor($user);

        // Vigyázat: a null érvényes érték (= nincs korlátozás), ezért nem
        // használható ?? — az a null-t is false-ra ejtené.
        return array_key_exists($this->id, $map) ? $map[$this->id] : false;
    }

    public function isVisibleTo(User $user): bool
    {
        return $this->accessFor($user) !== false;
    }

    /* ------------------------------------------------------------------ */
    /* Képesség-ellenőrzések (ACL + modul-jogosultság kombinálva)          */
    /* ------------------------------------------------------------------ */

    /**
     * Létrehozás/feltöltés a megadott mappában (null = gyökér).
     */
    public static function canCreateIn(User $user, ?self $folder): bool
    {
        $level = $folder?->accessFor($user);

        if ($level === false || $level === 'view') {
            return false;
        }

        return $level === 'edit' || $user->can('documents.create');
    }

    /**
     * Szerkesztés (átnevezés, áthelyezés forrásként) a mappában.
     */
    public static function canEditIn(User $user, ?self $folder): bool
    {
        $level = $folder?->accessFor($user);

        if ($level === false || $level === 'view') {
            return false;
        }

        return $level === 'edit' || $user->can('documents.edit');
    }

    /**
     * Törlés a mappában.
     */
    public static function canDeleteIn(User $user, ?self $folder): bool
    {
        $level = $folder?->accessFor($user);

        if ($level === false || $level === 'view') {
            return false;
        }

        return $level === 'edit' || $user->can('documents.delete');
    }

    /**
     * Jogosultságok kezelése ezen a mappán.
     */
    public function canManagePermissions(User $user): bool
    {
        if ($user->hasRole('IT Admin')) {
            return true;
        }

        return $this->accessFor($user) !== 'view'
            && $this->accessFor($user) !== false
            && ($user->can('documents.edit') || $this->accessFor($user) === 'edit');
    }

    /* ------------------------------------------------------------------ */
    /* Fa-segédek                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * Ős-mappák a gyökér felé haladva.
     *
     * @return array<int, self>
     */
    public function ancestors(): array
    {
        $ancestors = [];
        $node = $this->parent;
        $guard = 0;
        while ($node && $guard++ < 50) {
            $ancestors[] = $node;
            $node = $node->parent;
        }

        return $ancestors;
    }

    /**
     * Morzsasor a gyökértől ehhez a mappáig.
     *
     * @return array<int, array{id:int|null,name:string}>
     */
    public function breadcrumbs(): array
    {
        $crumbs = [['id' => null, 'name' => 'Fájlok']];
        foreach (array_reverse($this->ancestors()) as $a) {
            $crumbs[] = ['id' => $a->id, 'name' => $a->name];
        }
        $crumbs[] = ['id' => $this->id, 'name' => $this->name];

        return $crumbs;
    }

    /**
     * Leszármazottja-e a megadott mappának (mozgatási kör-védelem).
     */
    public function isDescendantOf(self $other): bool
    {
        foreach ($this->ancestors() as $a) {
            if ($a->id === $other->id) {
                return true;
            }
        }

        return false;
    }

    /**
     * Elérési út szövegesen (kereséshez / fájl-adatlaphoz).
     */
    public function pathString(): string
    {
        return implode(' / ', array_map(fn ($c) => $c['name'], $this->breadcrumbs()));
    }
}
