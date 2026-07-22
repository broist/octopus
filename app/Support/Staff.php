<?php

namespace App\Support;

/**
 * A Munkatársak / Erőforrások modul (6.) közös törzslistái — a form, a szűrő
 * és a validáció egyetlen forrása (a Modules / Subcontractors mintájára).
 */
class Staff
{
    /**
     * Végzettség- / jogosultságtípusok (lejárattal figyelt tételek).
     *
     * @return array<string, string>
     */
    public const QUALIFICATION_TYPES = [
        'vegzettseg' => 'Végzettség / szakképesítés',
        'tanusitvany' => 'Tanúsítvány',
        'gepkezelo' => 'Gépkezelői jogosítvány',
        'munkavedelem' => 'Munkavédelmi oktatás',
        'egeszsegugyi' => 'Egészségügyi alkalmasság',
        'egyeb' => 'Egyéb',
    ];

    /**
     * Távollét-típusok.
     *
     * @return array<string, string>
     */
    public const ABSENCE_TYPES = [
        'szabadsag' => 'Szabadság',
        'betegseg' => 'Betegség / táppénz',
        'egyeb' => 'Egyéb távollét',
    ];
}
