<?php

namespace App\Support;

/**
 * A Pénzügy / Költségvetés modul (spec §9) közös törzslistái.
 */
class Finance
{
    /**
     * Tervezett költségvetés kategóriái (tételes terv). A munkabér a spec szerint
     * NEM a pénzügyi modulban van, de tervezni tervezhető (munkadíj sorként).
     *
     * @return array<string, string>
     */
    public const BUDGET_CATEGORIES = [
        'munkadij' => 'Munkadíj',
        'anyag' => 'Anyag',
        'alvallalkozo' => 'Alvállalkozó',
        'gep' => 'Gép',
        'egyeb' => 'Egyéb',
    ];

    /**
     * Tényleges (nem anyag) költség kategóriái. Az anyagköltség az Anyagok
     * modulból jön automatikusan, ezért itt nincs „anyag".
     *
     * @return array<string, string>
     */
    public const COST_CATEGORIES = [
        'alvallalkozo' => 'Alvállalkozó',
        'gep' => 'Gép',
        'egyeb' => 'Egyéb',
    ];
}
