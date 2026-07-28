<?php

namespace App\Services;

use App\Models\Project;
use Illuminate\Support\Facades\DB;

/**
 * Ütemterv-sablon betöltése egy projektre (spec §6).
 *
 * A sablon több száz soros munkastruktúra, ezért nem soronként mentünk: a fát
 * szintenként visszük be egy-egy tömeges INSERT-tel, és a következő szint már
 * az előző szint frissen kapott azonosítóira hivatkozik. Egy 400+ soros sablon
 * így ~15 lekérdezésből betölt.
 *
 * A már meglévő fázisok érintetlenek maradnak: a sablon a `sort_order` végére
 * fűződik, tehát a kézzel felvett fázisok nem csúsznak el.
 */
class PhaseTemplateImporter
{
    /**
     * @param  array{rows:array<int, array{wbs:?string,level:int,name:string,group:bool,milestone:bool}>}  $template
     * @return int  a létrehozott fázisok száma
     */
    public function import(Project $project, array $template): int
    {
        $rows = array_values($template['rows']);

        if ($rows === []) {
            return 0;
        }

        $offset = (int) $project->phases()->max('sort_order');
        $parentIndex = $this->parentIndexes($rows);

        // Szintenként csoportosítva: a szülők mindig a gyerekek előtt jönnek létre.
        $byLevel = [];
        foreach ($rows as $i => $row) {
            $byLevel[$row['level']][] = $i;
        }
        ksort($byLevel);

        $now = now();
        $idByIndex = [];

        DB::transaction(function () use ($project, $rows, $parentIndex, $byLevel, $offset, $now, &$idByIndex) {
            foreach ($byLevel as $level => $indexes) {
                $payload = [];

                foreach ($indexes as $i) {
                    $parent = $parentIndex[$i];

                    $payload[] = [
                        'project_id' => $project->id,
                        'parent_id' => $parent === null ? null : $idByIndex[$parent],
                        'name' => $rows[$i]['name'],
                        'sort_order' => $offset + $i + 1,
                        'level' => $level,
                        'wbs' => $rows[$i]['wbs'],
                        'is_group' => $rows[$i]['group'],
                        'is_milestone' => $rows[$i]['milestone'],
                        'progress' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                DB::table('project_phases')->insert($payload);

                // A `sort_order` az importon belül egyedi és minden korábbinál
                // nagyobb, így biztonságosan visszaolvashatók róla az id-k.
                $ids = DB::table('project_phases')
                    ->where('project_id', $project->id)
                    ->whereIn('sort_order', array_map(fn ($i) => $offset + $i + 1, $indexes))
                    ->pluck('id', 'sort_order');

                foreach ($indexes as $i) {
                    $idByIndex[$i] = (int) $ids[$offset + $i + 1];
                }
            }
        });

        return count($rows);
    }

    /**
     * Melyik sor melyik korábbi sor gyereke — a szint-verem alapján.
     *
     * @param  array<int, array{level:int}>  $rows
     * @return array<int, int|null>
     */
    private function parentIndexes(array $rows): array
    {
        $parents = [];
        $stack = []; // szint => az adott szint legutóbbi sorának indexe

        foreach ($rows as $i => $row) {
            $level = $row['level'];

            $parents[$i] = $level === 0 ? null : ($stack[$level - 1] ?? null);

            foreach (array_keys($stack) as $open) {
                if ($open >= $level) {
                    unset($stack[$open]);
                }
            }
            $stack[$level] = $i;
        }

        return $parents;
    }
}
