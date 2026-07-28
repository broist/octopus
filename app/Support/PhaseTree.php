<?php

namespace App\Support;

use App\Models\ProjectPhase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * A fázis-fa segédműveletei (spec §6).
 *
 * A fázisok `parent_id` mentén fát alkotnak, a `sort_order` pedig a fa mélységi
 * bejárásának sorrendje — így a megjelenítéshez elég egy `orderBy('sort_order')`,
 * és a Gantt/lista sorrendje mindig egyezik.
 *
 * Az összegző (csoport) soroknak nincs saját dátuma és készültsége: azok a
 * gyerekekből gördülnek fel, ahogy az MS Project is csinálja.
 */
final class PhaseTree
{
    /** A gyökér sorok kulcsa a gyerek-térképben (a `parent_id` ott `null`). */
    private const ROOT = 0;

    /**
     * Szülő → gyerekek térkép, gyerekenként `sort_order` szerint rendezve.
     *
     * @param  Collection<int, ProjectPhase>  $phases
     * @return array<int, array<int, ProjectPhase>>
     */
    public static function childrenMap(Collection $phases): array
    {
        $map = [];

        foreach ($phases->sortBy([['sort_order', 'asc'], ['id', 'asc']]) as $phase) {
            $map[$phase->parent_id ?? self::ROOT][] = $phase;
        }

        return $map;
    }

    /**
     * Egy fázis testvérei (beleértve őt magát), megjelenítési sorrendben.
     *
     * @param  Collection<int, ProjectPhase>  $phases
     * @return array<int, ProjectPhase>
     */
    public static function siblingsOf(Collection $phases, ProjectPhase $phase): array
    {
        return self::childrenMap($phases)[$phase->parent_id ?? self::ROOT] ?? [];
    }

    /**
     * Mélységi bejárás: a fa helyes megjelenítési sorrendje.
     *
     * Az árván maradt sorokat (nem létező szülő) a végére fűzi, hogy egy
     * sérült hivatkozás se tüntessen el fázisokat a felületről.
     *
     * @param  Collection<int, ProjectPhase>  $phases
     * @return Collection<int, ProjectPhase>
     */
    public static function flatten(Collection $phases): Collection
    {
        $map = self::childrenMap($phases);
        $out = collect();
        $seen = [];

        $walk = function (int $parent) use (&$walk, $map, $out, &$seen): void {
            foreach ($map[$parent] ?? [] as $phase) {
                if (isset($seen[$phase->id])) {
                    continue; // körvédelem
                }
                $seen[$phase->id] = true;
                $out->push($phase);
                $walk($phase->id);
            }
        };

        $walk(self::ROOT);

        foreach ($phases as $phase) {
            if (! isset($seen[$phase->id])) {
                $out->push($phase);
            }
        }

        return $out;
    }

    /**
     * A `sort_order` és a `level` újraírása a fa alapján. Csak a ténylegesen
     * változott sorokra megy UPDATE, így egy sorrend-csere nem ír vissza
     * több száz rekordot.
     *
     * @param  Collection<int, ProjectPhase>  $phases
     * @param  Collection<int, ProjectPhase>|null  $ordered  kész sorrend (pl. mozgatás után)
     */
    public static function resequence(Collection $phases, ?Collection $ordered = null): void
    {
        $depth = [];
        $order = 0;

        $updates = [];

        foreach ($ordered ?? self::flatten($phases) as $phase) {
            $level = $phase->parent_id === null ? 0 : ($depth[$phase->parent_id] ?? 0) + 1;
            $depth[$phase->id] = $level;
            $order++;

            if ($phase->sort_order !== $order || $phase->level !== $level) {
                $updates[] = ['id' => $phase->id, 'sort_order' => $order, 'level' => $level];
                $phase->sort_order = $order;
                $phase->level = $level;
            }
        }

        if ($updates === []) {
            return;
        }

        DB::transaction(function () use ($updates) {
            foreach ($updates as $u) {
                ProjectPhase::whereKey($u['id'])->update([
                    'sort_order' => $u['sort_order'],
                    'level' => $u['level'],
                ]);
            }
        });
    }

    /**
     * Egy fázis és minden leszármazottjának azonosítója (a törléshez és a
     * kijelöléshez: egy csoport kijelölése az egész ágat viszi).
     *
     * @param  Collection<int, ProjectPhase>  $phases
     * @return array<int, int>
     */
    public static function subtreeIds(Collection $phases, int $rootId): array
    {
        $map = self::childrenMap($phases);
        $ids = [$rootId];

        for ($i = 0; $i < count($ids); $i++) {
            foreach ($map[$ids[$i]] ?? [] as $child) {
                $ids[] = $child->id;
            }
        }

        return $ids;
    }

    /**
     * Az összegző sorok felgördített értékei.
     *
     * A dátumok a leszármazottak legkorábbi kezdése és legkésőbbi határideje,
     * a készültség a *tényleges munkasorok* (nem csoportok) átlaga — a
     * csoportokat nem számoljuk kétszer.
     *
     * @param  Collection<int, ProjectPhase>  $phases
     * @return array<int, array{starts_on:?string,due_on:?string,progress:int,leaf_count:int}>
     */
    public static function rollup(Collection $phases): array
    {
        $map = self::childrenMap($phases);
        $out = [];

        // Mélységi bejárás után visszafelé összegzünk, így a gyerekek értékei
        // már készen állnak, mire a szülőhöz érünk.
        $compute = function (ProjectPhase $phase) use (&$compute, $map, &$out): array {
            $starts = $phase->starts_on?->toDateString();
            $due = $phase->due_on?->toDateString();
            $sum = $phase->is_group ? 0 : $phase->progress;
            $count = $phase->is_group ? 0 : 1;

            foreach ($map[$phase->id] ?? [] as $child) {
                $c = $compute($child);

                if ($c['starts_on'] !== null && ($starts === null || $c['starts_on'] < $starts)) {
                    $starts = $c['starts_on'];
                }
                if ($c['due_on'] !== null && ($due === null || $c['due_on'] > $due)) {
                    $due = $c['due_on'];
                }

                $sum += $c['progress'] * $c['leaf_count'];
                $count += $c['leaf_count'];
            }

            $result = [
                'starts_on' => $starts,
                'due_on' => $due,
                'progress' => $count > 0 ? (int) round($sum / $count) : 0,
                'leaf_count' => $count,
            ];

            $out[$phase->id] = $result;

            return $result;
        };

        foreach ($map[self::ROOT] ?? [] as $root) {
            $compute($root);
        }

        return $out;
    }
}
