<?php

namespace App\Support;

use Illuminate\Support\Facades\File;

/**
 * Ütemterv-sablonok (spec §6).
 *
 * Egy sablon kész munkastruktúra (WBS): csoportok és alattuk a tényleges
 * munkanemek, ahogy egy tipikus kivitelezés felépül. Új projekt indításakor
 * a sablon egy kattintással betölthető, utána a nem odavaló sorok törölhetők
 * — így nem több száz sort kell kézzel felvinni, csak megnyesni a fát.
 *
 * A sablonok a `database/data/phase-templates` mappában JSON-ként élnek, mert
 * MS Project (.mpp) fájlokból generáljuk őket (lásd az ottani README-t), és
 * így verziózhatók anélkül, hogy PHP-kódot kellene írni hozzájuk.
 *
 * JSON-formátum:
 *   {
 *     "key": "...", "name": "...", "description": "...", "source": "....mpp",
 *     "rows": [ {"wbs":"1.4","level":1,"name":"…","group":true,"milestone":false}, … ]
 *   }
 *
 * A `rows` mélységi (depth-first) sorrendben áll, a `level` 0-ról indul, és
 * egyszerre legfeljebb egyet nőhet — ebből épül fel a fa.
 */
class PhaseTemplates
{
    /** Új projektnél ez töltődik be alapértelmezésben. */
    public const DEFAULT_KEY = 'hotel-standard';

    /** @var array<string, array<string, mixed>>|null */
    private static ?array $cache = null;

    public static function directory(): string
    {
        return database_path('data/phase-templates');
    }

    /**
     * Minden sablon, kulcs szerint. A fájlok egyszer olvasódnak be kérésenként.
     *
     * @return array<string, array{key:string,name:string,description:string,source:?string,rows:array<int, array<string, mixed>>}>
     */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $out = [];

        if (File::isDirectory(self::directory())) {
            foreach (File::glob(self::directory().'/*.json') as $path) {
                $data = json_decode((string) File::get($path), true);
                if (! is_array($data) || ! isset($data['rows']) || ! is_array($data['rows'])) {
                    continue;
                }

                $key = (string) ($data['key'] ?? pathinfo($path, PATHINFO_FILENAME));

                $out[$key] = [
                    'key' => $key,
                    'name' => (string) ($data['name'] ?? $key),
                    'description' => (string) ($data['description'] ?? ''),
                    'source' => $data['source'] ?? null,
                    'rows' => self::normalizeRows($data['rows']),
                ];
            }
        }

        // Az alapértelmezett sablon kerüljön a lista élére.
        uksort($out, fn (string $a, string $b) => match (true) {
            $a === self::DEFAULT_KEY => -1,
            $b === self::DEFAULT_KEY => 1,
            default => strcmp($a, $b),
        });

        return self::$cache = $out;
    }

    public static function exists(string $key): bool
    {
        return array_key_exists($key, self::all());
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function find(string $key): ?array
    {
        return self::all()[$key] ?? null;
    }

    /**
     * Sablonlista a felületnek: sor- és csoportszám, plusz a felső szint
     * előnézete, hogy a felhasználó lássa, mit tölt be.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function catalogue(): array
    {
        $out = [];

        foreach (self::all() as $template) {
            $rows = $template['rows'];

            $out[] = [
                'key' => $template['key'],
                'name' => $template['name'],
                'description' => $template['description'],
                'row_count' => count($rows),
                'group_count' => count(array_filter($rows, fn ($r) => $r['group'])),
                'is_default' => $template['key'] === self::DEFAULT_KEY,
                'preview' => array_values(array_map(
                    fn ($r) => $r['name'],
                    array_filter($rows, fn ($r) => $r['level'] <= 1),
                )),
            ];
        }

        return $out;
    }

    /**
     * Sorok tisztítása: hiányzó mezők pótlása, szintugrások kisimítása —
     * egy sérült sablonfájl se boríthassa fel a fa felépítését.
     *
     * @param  array<int, mixed>  $rows
     * @return array<int, array{wbs:?string,level:int,name:string,group:bool,milestone:bool}>
     */
    private static function normalizeRows(array $rows): array
    {
        $out = [];
        $previousLevel = -1;

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }

            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $level = max(0, (int) ($row['level'] ?? 0));
            $level = min($level, $previousLevel + 1);

            $out[] = [
                'wbs' => isset($row['wbs']) ? (string) $row['wbs'] : null,
                'level' => $level,
                'name' => mb_substr($name, 0, 200),
                'group' => (bool) ($row['group'] ?? false),
                'milestone' => (bool) ($row['milestone'] ?? false),
            ];

            $previousLevel = $level;
        }

        return $out;
    }
}
