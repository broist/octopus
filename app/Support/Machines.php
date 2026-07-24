<?php

namespace App\Support;

/**
 * A Gépek és eszközök modul (spec §7) közös törzslistái — a form, a szűrő és a
 * validáció egyetlen forrása (a Subcontractors/Staff mintájára).
 */
class Machines
{
    /**
     * Gép/eszköz kategóriák. Csak nagyobb gépeket és értékesebb eszközöket
     * követünk — kéziszerszám tételes nyilvántartása nem cél (spec §7).
     *
     * @return array<string, string>
     */
    public const KINDS = [
        'foldmunka' => 'Földmunkagép (kotró, rakodó)',
        'emelogep' => 'Emelőgép (daru, emelő)',
        'betontechnika' => 'Betontechnika (keverő, szivattyú)',
        'szallitas' => 'Szállítójármű / utánfutó',
        'allvanyzat' => 'Állványzat / zsalu',
        'aramfejleszto' => 'Áramfejlesztő / kompresszor',
        'kezi_nagygep' => 'Kézi nagygép (bontó, vágó)',
        'merestechnika' => 'Méréstechnika / műszer',
        'egyeb' => 'Egyéb',
    ];

    /**
     * Aktuális státusz (spec §7: szabad / használatban / szervizben).
     *
     * @return array<string, string>
     */
    public const STATUSES = [
        'szabad' => 'Szabad',
        'hasznalatban' => 'Használatban',
        'szervizben' => 'Szervizben',
    ];

    /**
     * Tulajdonviszony (spec §7: saját tulajdon vagy bérelt).
     *
     * @return array<string, string>
     */
    public const OWNERSHIP = [
        'sajat' => 'Saját tulajdon',
        'berelt' => 'Bérelt',
    ];

    /**
     * Karbantartási előzmény típusai.
     *
     * @return array<string, string>
     */
    public const MAINTENANCE_TYPES = [
        'szerviz' => 'Időszakos szerviz',
        'javitas' => 'Javítás',
        'vizsga' => 'Műszaki vizsga',
        'egyeb' => 'Egyéb',
    ];

    /**
     * Csatolt dokumentumok kategóriái (gépkönyv, biztosítás, vizsgadok.).
     *
     * @return array<string, string>
     */
    public const DOC_CATEGORIES = [
        'gepkonyv' => 'Gépkönyv / kezelési útmutató',
        'biztositas' => 'Biztosítás',
        'vizsga' => 'Vizsgadokumentum',
        'szamla' => 'Beszerzési / bérleti számla',
        'egyeb' => 'Egyéb',
    ];
}
