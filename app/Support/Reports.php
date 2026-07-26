<?php

namespace App\Support;

use App\Services\ReportBuilder;
use Carbon\CarbonImmutable;

/**
 * A Riportok / Statisztikák modul (spec §15) katalógusa.
 *
 * Egyetlen forrás a riportok listájához (fülek), a hozzájuk tartozó szűrőkhöz
 * és bontásokhoz. A tényleges számítás a {@see ReportBuilder}-ben
 * történik, az exportálás (CSV/PDF) pedig ugyanazt a normalizált szerkezetet
 * használja, mint a képernyő — így minden riport egy helyen szabható testre.
 */
class Reports
{
    public const DEFAULT_KEY = 'nyeresegesseg';

    /**
     * A fix riportok (spec §15). Mezők:
     *  - filters: mely szűrőket értelmezi a riport (period|project|status)
     *  - groups: választható bontások (üres = nincs bontásváltó)
     *  - default_period: melyik időszak-előbeállítással nyíljon
     *
     * @return array<string, array{label:string,title:string,subtitle:string,filters:array<int,string>,groups:array<string,string>,default_group:?string,default_period:string}>
     */
    public const ALL = [
        'nyeresegesseg' => [
            'label' => 'Nyereségesség',
            'title' => 'Projekt-nyereségesség',
            'subtitle' => 'Projektenként bevétel − költség (anyag, alvállalkozó, gép, egyéb), az alprojektekkel együtt.',
            'filters' => ['period', 'project', 'status'],
            'groups' => [],
            'default_group' => null,
            'default_period' => 'minden',
        ],
        'csuszas' => [
            'label' => 'Csúszás',
            'title' => 'Csúszás-elemzés',
            'subtitle' => 'Tervezett vs. tényleges határidők — hol és mennyit csúszik a munka.',
            'filters' => ['period', 'project', 'status'],
            'groups' => [
                'fazis' => 'Fázisonként',
                'projekt' => 'Projektenként',
                'feladat' => 'Feladatonként',
            ],
            'default_group' => 'fazis',
            'default_period' => 'ez-az-ev',
        ],
        'koltseg' => [
            'label' => 'Költség terv-tény',
            'title' => 'Költség-elemzés',
            'subtitle' => 'Tervezett vs. tényleges költség — hol léptek túl a kereten.',
            'filters' => ['period', 'project', 'status'],
            'groups' => [
                'projekt' => 'Projektenként',
                'kategoria' => 'Kategóriánként',
            ],
            'default_group' => 'projekt',
            'default_period' => 'minden',
        ],
        'eroforras' => [
            'label' => 'Erőforrás',
            'title' => 'Erőforrás-kihasználtság',
            'subtitle' => 'Emberek és gépek lekötöttsége a választott időszakban.',
            'filters' => ['period', 'project'],
            'groups' => [
                'emberek' => 'Munkatársak',
                'gepek' => 'Gépek',
            ],
            'default_group' => 'emberek',
            'default_period' => 'ez-a-honap',
        ],
        'alvallalkozo' => [
            'label' => 'Alvállalkozók',
            'title' => 'Alvállalkozói statisztika',
            'subtitle' => 'Melyik alvállalkozóval mennyit, milyen értékben, milyen értékeléssel.',
            'filters' => ['period', 'project'],
            'groups' => [],
            'default_group' => null,
            'default_period' => 'minden',
        ],
        'kifizetes' => [
            'label' => 'Kifizetések',
            'title' => 'Kintlévőségek / esedékes kifizetések',
            'subtitle' => 'Bejövő számlák: mi esedékes, mi járt le, kinek mennyivel tartozunk.',
            'filters' => ['period', 'project'],
            'groups' => [
                'szamla' => 'Számlánként',
                'partner' => 'Partnerenként',
            ],
            'default_group' => 'szamla',
            'default_period' => 'minden',
        ],
        'minoseg' => [
            'label' => 'Minőség',
            'title' => 'Minőségi és munkavédelmi statisztika',
            'subtitle' => 'Hibák, ellenőrzések és munkavédelmi bejegyzések megoszlása.',
            'filters' => ['period', 'project'],
            'groups' => [
                'projekt' => 'Projektenként',
                'sulyossag' => 'Súlyosság szerint',
            ],
            'default_group' => 'projekt',
            'default_period' => 'ez-az-ev',
        ],
        'idoszaki' => [
            'label' => 'Időszaki összesítő',
            'title' => 'Időszaki összesítő',
            'subtitle' => 'Havi / negyedéves / éves kimutatás a költségekről és a teljesítményről.',
            'filters' => ['period', 'project'],
            'groups' => [
                'honap' => 'Havi bontás',
                'negyedev' => 'Negyedéves bontás',
                'ev' => 'Éves bontás',
            ],
            'default_group' => 'honap',
            'default_period' => 'ez-az-ev',
        ],
    ];

    /**
     * Időszak-előbeállítások (a „testre szabható" nézet gyorsgombjai).
     *
     * @return array<string, string>
     */
    public const PERIODS = [
        'ez-a-honap' => 'Ez a hónap',
        'elozo-honap' => 'Előző hónap',
        'ez-a-negyedev' => 'Ez a negyedév',
        'ez-az-ev' => 'Ez az év',
        'elozo-ev' => 'Előző év',
        'minden' => 'Teljes időtartam',
        'egyedi' => 'Egyedi időszak',
    ];

    public static function exists(string $key): bool
    {
        return array_key_exists($key, self::ALL);
    }

    /**
     * @return array<string, mixed>
     */
    public static function definition(string $key): array
    {
        return self::ALL[$key];
    }

    /**
     * A fülekhez: kulcs + felirat, sorrendben.
     *
     * @return array<int, array{key:string,label:string,title:string}>
     */
    public static function tabs(): array
    {
        $tabs = [];
        foreach (self::ALL as $key => $def) {
            $tabs[] = ['key' => $key, 'label' => $def['label'], 'title' => $def['title']];
        }

        return $tabs;
    }

    /**
     * Az előbeállításból konkrét dátum-tartomány (null = nincs korlát).
     *
     * @return array{0: ?CarbonImmutable, 1: ?CarbonImmutable}
     */
    public static function range(string $period, ?string $from, ?string $to): array
    {
        $today = CarbonImmutable::today();

        return match ($period) {
            'ez-a-honap' => [$today->startOfMonth(), $today->endOfMonth()],
            'elozo-honap' => [$today->subMonth()->startOfMonth(), $today->subMonth()->endOfMonth()],
            'ez-a-negyedev' => [$today->startOfQuarter(), $today->endOfQuarter()],
            'ez-az-ev' => [$today->startOfYear(), $today->endOfYear()],
            'elozo-ev' => [$today->subYear()->startOfYear(), $today->subYear()->endOfYear()],
            'egyedi' => [
                $from ? CarbonImmutable::parse($from) : null,
                $to ? CarbonImmutable::parse($to) : null,
            ],
            default => [null, null], // minden
        };
    }
}
