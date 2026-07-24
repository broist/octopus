<?php

namespace App\Support;

/**
 * A Minőség / Munkavédelem modul (spec §12) közös törzslistái — a form, a szűrő
 * és a validáció egyetlen forrása (a Machines/Materials mintájára).
 */
class Qa
{
    /**
     * Ellenőrzés / sablon célja (spec §12: átadás-átvétel, munkavédelem, minőség).
     *
     * @return array<string, string>
     */
    public const PURPOSES = [
        'atadas' => 'Átadás-átvétel',
        'munkavedelem' => 'Munkavédelem / biztonság',
        'minoseg' => 'Minőségi ellenőrzés',
        'egyeb' => 'Egyéb',
    ];

    /**
     * Egy ellenőrzési tétel eredménye (checklist kitöltés).
     *
     * @return array<string, string>
     */
    public const INSPECTION_RESULTS = [
        'nyitott' => 'Nyitott',
        'megfelelt' => 'Megfelelt',
        'nem_megfelelt' => 'Nem megfelelt',
        'na' => 'Nem értelmezhető',
    ];

    /**
     * Hiba / hiányosság státusza (spec §12: nyitott / javítás alatt / lezárt).
     *
     * @return array<string, string>
     */
    public const DEFECT_STATUSES = [
        'nyitott' => 'Nyitott',
        'javitas_alatt' => 'Javítás alatt',
        'lezart' => 'Lezárt',
    ];

    /**
     * Hiba súlyossága (a feladattá alakításkor a prioritásra képződik le).
     *
     * @return array<string, string>
     */
    public const SEVERITIES = [
        'alacsony' => 'Alacsony',
        'kozepes' => 'Közepes',
        'magas' => 'Magas',
    ];

    /**
     * Munkavédelmi nyilvántartás bejegyzés-típusa (spec §12: oktatás, bejárás,
     * esemény-/baleseti napló).
     *
     * @return array<string, string>
     */
    public const SAFETY_TYPES = [
        'oktatas' => 'Oktatás',
        'bejaras' => 'Bejárás',
        'esemeny' => 'Esemény',
        'baleset' => 'Baleset',
    ];
}
