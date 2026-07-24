<?php

namespace App\Support;

/**
 * Az Anyagok / Készlet modul (spec §8) közös törzslistái — a form, a szűrő és a
 * validáció egyetlen forrása (a Machines/Subcontractors mintájára).
 */
class Materials
{
    /**
     * Anyagkategóriák (építőipari gyakorlat szerint).
     *
     * @return array<string, string>
     */
    public const CATEGORIES = [
        'epitoanyag' => 'Építőanyag (tégla, sóder, cement)',
        'beton' => 'Beton / vasbeton',
        'szigeteles' => 'Szigetelés',
        'burkolat' => 'Burkolat (csempe, padló)',
        'festek_vakolat' => 'Festék / vakolat',
        'gepeszet' => 'Gépészet (víz, fűtés, szellőzés)',
        'villamos' => 'Villamos / elektromos',
        'nyilaszaro' => 'Nyílászáró',
        'faanyag' => 'Faanyag',
        'szarazepites' => 'Szárazépítés (gipszkarton)',
        'fem' => 'Fém / acél',
        'kert_kulso' => 'Kert / külső',
        'egyeb' => 'Egyéb',
    ];

    /**
     * Mértékegységek (spec §8: m², db, zsák, m³ stb.).
     *
     * @return array<string, string>
     */
    public const UNITS = [
        'db' => 'db',
        'm' => 'm',
        'm2' => 'm²',
        'm3' => 'm³',
        'fm' => 'fm (folyóméter)',
        'kg' => 'kg',
        't' => 't (tonna)',
        'liter' => 'liter',
        'zsak' => 'zsák',
        'raklap' => 'raklap',
        'csomag' => 'csomag',
        'tekercs' => 'tekercs',
        'keszlet' => 'készlet',
    ];

    /**
     * Beszerzés státusza (spec §8: megrendelve / beérkezett + a „tervezett"
     * állapot a hiány-riasztáshoz).
     *
     * @return array<string, string>
     */
    public const STATUSES = [
        'tervezett' => 'Tervezett',
        'megrendelve' => 'Megrendelve',
        'beerkezett' => 'Beérkezett',
    ];
}
