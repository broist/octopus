<?php

namespace App\Support;

/**
 * Az Alvállalkozók modul közös törzslistái (spec §5/5) — a form, a szűrő és a
 * validáció egyetlen forrása (a Modules mintájára).
 */
class Subcontractors
{
    /**
     * Szakmák / szakterületek — a spec példái + a gyakori építőipari szakmák.
     * A partner.trade ezekből az egyik (szabadszöveg „egyeb" fallback).
     *
     * @return array<string, string>
     */
    public const TRADES = [
        'villanyszereles' => 'Villanyszerelés',
        'gepeszet' => 'Gépészet',
        'burkolas' => 'Burkolás',
        'festes' => 'Festés-mázolás',
        'komuves' => 'Kőműves / szerkezetépítés',
        'acs' => 'Ács / tetőszerkezet',
        'tetofedes' => 'Tetőfedés-bádogos',
        'szigeteles' => 'Szigetelés',
        'foldmunka' => 'Földmunka / gépi munka',
        'asztalos' => 'Asztalos / nyílászáró',
        'szarazepites' => 'Szárazépítés',
        'kertepites' => 'Kertépítés / külső',
        'egyeb' => 'Egyéb',
    ];

    /**
     * Jogi/adminisztratív dokumentumtípusok (lejárattal figyelt tételek).
     *
     * @return array<string, string>
     */
    public const CERT_TYPES = [
        'szerzodes' => 'Szerződés',
        'biztositas' => 'Felelősségbiztosítás',
        'engedely' => 'Engedély',
        'tanusitvany' => 'Tanúsítvány / képesítés',
        'kamara' => 'Kamarai regisztráció',
        'egyeb' => 'Egyéb',
    ];

    /**
     * Csatolt dokumentumok kategóriái.
     *
     * @return array<string, string>
     */
    public const DOC_CATEGORIES = [
        'szerzodes' => 'Szerződés',
        'teljesitesigazolas' => 'Teljesítésigazolás',
        'szamla' => 'Bejövő számla',
        'egyeb' => 'Egyéb',
    ];
}
