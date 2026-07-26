<?php

namespace App\Support;

/**
 * Mappastruktúra-sablonok a Fájlkezelőhöz (spec §10).
 *
 * A megrendelő által megadott céges és projekt-struktúra egy kattintással
 * létrehozható, hogy ne kelljen több száz mappát kézzel felvinni. A sablonok
 * ismételten is alkalmazhatók: a már létező mappákat nem duplikálják, csak a
 * hiányzókat pótolják — így egy meglévő struktúra utólag is „feltölthető”.
 *
 * A fa formátuma: `['Mappanév' => [almappák…]]`, üres tömb = nincs almappa.
 * A nevekben a `{ev}` helyettesítő az aktuális évre cserélődik.
 */
class FolderTemplates
{
    /**
     * @return array<string, array{label:string,description:string,root:?string,name_label:?string,name_hint:?string,tree:array<string, mixed>}>
     */
    public static function all(): array
    {
        return [
            'ceg' => [
                'label' => 'Céges mappastruktúra',
                'description' => 'A teljes cégszintű rendszer: beérkező dokumentumok, cégvezetés, pénzügy, HR, '
                    .'munkavédelem, értékesítés, projektek, beszerzés, alvállalkozók, gépek, partnerek, '
                    .'marketing, sablonok, IT és archívum.',
                'root' => null,
                'name_label' => null,
                'name_hint' => null,
                'tree' => self::companyTree(),
            ],
            'projekt' => [
                'label' => 'Projekt mappastruktúra',
                'description' => 'Egy projekt teljes dossziéja: projektirányítás, szerződések, tervek, költségvetés, '
                    .'beszerzés, kivitelezés, naplók, számlázás, fotók, átadás-átvétel és garancia.',
                'root' => '{ev}-001_PROJEKT_NEVE_HELYSZÍN',
                'name_label' => 'A projekt mappájának neve',
                'name_hint' => 'Pl. 2026-001_Családi_ház_Noszvaj — vagy válassz projektet a listából.',
                'tree' => self::projectTree(),
            ],
            'dolgozo' => [
                'label' => 'Dolgozó mappa',
                'description' => 'Egy munkatárs személyi dossziéja — a 03_HR_ÉS_MUNKAÜGY / Dolgozók mappába.',
                'root' => 'VEZETÉKNÉV_Keresztnév',
                'name_label' => 'A dolgozó mappájának neve',
                'name_hint' => 'Pl. KOVÁCS_István',
                'tree' => [
                    'Munkaszerződés' => [],
                    'Személyes_okmányok' => [],
                    'Orvosi_alkalmasság' => [],
                    'Oktatások' => [],
                    'Jelenléti_ívek' => [],
                    'Szabadságok' => [],
                ],
            ],
            'alvallalkozo' => [
                'label' => 'Alvállalkozó mappa',
                'description' => 'Egy alvállalkozó dossziéja — a 08_ALVÁLLALKOZÓK mappába.',
                'root' => 'ALVÁLLALKOZÓ_NEVE',
                'name_label' => 'Az alvállalkozó mappájának neve',
                'name_hint' => 'Pl. VILLANY_KFT',
                'tree' => [
                    'Cégiratok' => [],
                    'Keretszerződések' => [],
                    'Biztosítások' => [],
                    'Munkavédelmi_dokumentumok' => [],
                    'Teljesítésigazolások' => [],
                    'Számlák' => [],
                    'Értékelések' => [],
                ],
            ],
            'jarmu' => [
                'label' => 'Jármű mappa',
                'description' => 'Egy jármű dossziéja — a 09_GÉPEK_JÁRMŰVEK_ESZKÖZÖK / Járművek mappába.',
                'root' => 'RENDSZÁM_TÍPUS',
                'name_label' => 'A jármű mappájának neve',
                'name_hint' => 'Pl. ABC-123_Ford_Transit',
                'tree' => [
                    'Forgalmi_és_biztosítás' => [],
                    'Szerviz' => [],
                    'Műszaki_vizsga' => [],
                    'Menetlevelek' => [],
                    'Káresemények' => [],
                ],
            ],
            'ugyfel' => [
                'label' => 'Ügyfél mappa',
                'description' => 'Egy ügyfél dossziéja — a 05_ÉRTÉKESÍTÉS_ÉS_AJÁNLATOK / Ügyfelek mappába.',
                'root' => 'ÜGYFÉL_NEVE',
                'name_label' => 'Az ügyfél mappájának neve',
                'name_hint' => 'Pl. MINTA_KFT',
                'tree' => [
                    'Ajánlatok' => [],
                    'Szerződések' => [],
                    'Levelezés' => [],
                    'Számlák' => [],
                ],
            ],
        ];
    }

    public static function exists(string $key): bool
    {
        return array_key_exists($key, self::all());
    }

    /**
     * @return array<string, mixed>
     */
    public static function get(string $key): array
    {
        return self::all()[$key];
    }

    /**
     * A felületnek: sablonlista előnézettel és mappaszámmal (a `{ev}` már
     * feloldva, hogy a felhasználó pontosan azt lássa, ami létrejön).
     *
     * @return array<int, array<string, mixed>>
     */
    public static function catalogue(): array
    {
        $out = [];

        foreach (self::all() as $key => $template) {
            $tree = self::resolve($template['tree']);

            $out[] = [
                'key' => $key,
                'label' => $template['label'],
                'description' => $template['description'],
                'root' => $template['root'] ? self::placeholders($template['root']) : null,
                'name_label' => $template['name_label'],
                'name_hint' => $template['name_hint'],
                'folder_count' => self::count($tree) + ($template['root'] ? 1 : 0),
                'preview' => self::preview($tree),
            ];
        }

        return $out;
    }

    /**
     * A helyettesítők feloldása egy néven ({ev} = aktuális év).
     */
    public static function placeholders(string $name): string
    {
        return str_replace('{ev}', (string) now()->year, $name);
    }

    /**
     * Az egész fa neveinek feloldása.
     *
     * @param  array<string, mixed>  $tree
     * @return array<string, mixed>
     */
    public static function resolve(array $tree): array
    {
        $out = [];
        foreach ($tree as $name => $children) {
            $out[self::placeholders((string) $name)] = self::resolve((array) $children);
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $tree
     */
    public static function count(array $tree): int
    {
        $n = 0;
        foreach ($tree as $children) {
            $n += 1 + self::count((array) $children);
        }

        return $n;
    }

    /**
     * Előnézet a dialógusnak: a felső szint, alatta az almappák neveivel.
     *
     * @param  array<string, mixed>  $tree
     * @return array<int, array{name:string,children:array<int,string>}>
     */
    private static function preview(array $tree): array
    {
        $out = [];
        foreach ($tree as $name => $children) {
            $out[] = [
                'name' => (string) $name,
                'children' => array_map('strval', array_keys((array) $children)),
            ];
        }

        return $out;
    }

    /**
     * A cégszintű struktúra. A személy-/partner-/jármű-szintű mappák (pl.
     * „VEZETÉKNÉV_Keresztnév”) szándékosan NEM jönnek létre üres placeholderként
     * — azokat a saját sablonjukkal, valódi névvel lehet hozzáadni.
     *
     * @return array<string, mixed>
     */
    private static function companyTree(): array
    {
        return [
            '00_BEÉRKEZŐ_DOKUMENTUMOK' => [
                'Feldolgozásra_vár' => [],
                'Számlák' => [],
                'Szerződések' => [],
                'Egyéb' => [],
            ],
            '01_CÉGVEZETÉS' => [
                'Cégiratok' => [
                    'Alapító_okirat' => [],
                    'Cégkivonat' => [],
                    'Engedélyek' => [],
                    'Biztosítások' => [],
                    'Tanúsítványok' => [],
                ],
                'Szabályzatok' => [],
                'Vezetői_döntések' => [],
                'Értekezletek' => [],
                'Üzleti_tervek' => [],
            ],
            '02_PÉNZÜGY_ÉS_KÖNYVELÉS' => [
                '{ev}' => [
                    'Bejövő_számlák' => [],
                    'Kimenő_számlák' => [],
                    'Bank' => [],
                    'Pénztár' => [],
                    'Adóbevallások' => [],
                    'Bérszámfejtés' => [],
                    'Könyvelőnek_átadott' => [],
                ],
                'Költségvetések' => [],
                'Cash-flow' => [],
                'Kintlévőségek' => [],
                'Kötelezettségek' => [],
                'Pénzügyi_riportok' => [],
            ],
            '03_HR_ÉS_MUNKAÜGY' => [
                'Dolgozók' => [],
                'Munkaköri_leírások' => [],
                'Toborzás' => [],
                'Munkaidő-nyilvántartás' => [],
                'Béradatok' => [],
                'Kilépett_dolgozók' => [],
            ],
            '04_MUNKAVÉDELEM_ÉS_MINŐSÉG' => [
                'Munkavédelmi_szabályzatok' => [],
                'Kockázatértékelések' => [],
                'Oktatási_naplók' => [],
                'Baleseti_jegyzőkönyvek' => [],
                'Tűzvédelem' => [],
                'Minőségirányítás' => [],
                'Ellenőrzési_jegyzőkönyvek' => [],
                'Gépek_felülvizsgálatai' => [],
            ],
            '05_ÉRTÉKESÍTÉS_ÉS_AJÁNLATOK' => [
                'Beérkezett_ajánlatkérések' => [],
                'Készülő_ajánlatok' => [],
                'Kiküldött_ajánlatok' => [],
                'Megnyert_ajánlatok' => [],
                'Elvesztett_ajánlatok' => [],
                'Árajánlat_sablonok' => [],
                'Referenciák' => [],
                'Ügyfelek' => [],
            ],
            '06_PROJEKTEK' => [
                '{ev}' => [],
                'Lezárt_projektek' => [],
                'Projekt_sablon' => [],
            ],
            '07_BESZERZÉS_ÉS_RAKTÁR' => [
                'Beszállítók' => [],
                'Árajánlatkérések' => [],
                'Beszállítói_ajánlatok' => [],
                'Megrendelések' => [],
                'Szállítólevelek' => [],
                'Anyagnyilvántartás' => [],
                'Raktárkészlet' => [],
                'Leltár' => [],
            ],
            '08_ALVÁLLALKOZÓK' => [],
            '09_GÉPEK_JÁRMŰVEK_ESZKÖZÖK' => [
                'Járművek' => [],
                'Munkagépek' => [],
                'Kisgépek' => [],
                'Szerszámok' => [],
                'Karbantartási_naplók' => [],
                'Eszközkiadások' => [],
            ],
            '10_PARTNEREK_ÉS_KAPCSOLATOK' => [
                'Megrendelők' => [],
                'Tervezők' => [],
                'Műszaki_ellenőrök' => [],
                'Hatóságok' => [],
                'Beszállítók' => [],
                'Alvállalkozók' => [],
            ],
            '11_MARKETING_ÉS_REFERENCIÁK' => [
                'Arculati_anyagok' => [],
                'Logók' => [],
                'Weboldal' => [],
                'Közösségi_média' => [],
                'Projektfotók' => [],
                'Referencialevelek' => [],
                'Bemutatkozó_anyagok' => [],
            ],
            '12_SABLONOK' => [
                'Szerződés_sablonok' => [],
                'Árajánlat_sablonok' => [],
                'Jegyzőkönyv_sablonok' => [],
                'Teljesítésigazolás_sablonok' => [],
                'Munkavédelmi_sablonok' => [],
                'Projekt_sablonok' => [],
                'Levél_sablonok' => [],
            ],
            '13_IT_ÉS_RENDSZEREK' => [
                'Szoftverlicencek' => [],
                'Eszköznyilvántartás' => [],
                'Felhasználói_jogosultságok' => [],
                'Rendszerdokumentáció' => [],
                'Biztonsági_mentések' => [],
            ],
            '99_ARCHÍVUM' => [
                'Lezárt_projektek' => [],
                'Korábbi_pénzügyi_évek' => [],
                'Kilépett_dolgozók' => [],
                'Lejárt_szerződések' => [],
                'Selejtezésre_vár' => [],
            ],
        ];
    }

    /**
     * Egy projekt teljes dossziéja.
     *
     * @return array<string, mixed>
     */
    private static function projectTree(): array
    {
        return [
            '00_PROJEKTIRÁNYÍTÁS' => [
                'Projektadatlap' => [],
                'Kapcsolattartók' => [],
                'Ütemterv' => [],
                'Feladatlista' => [],
                'Kooperációk' => [],
                'Levelezés' => [],
            ],
            '01_SZERZŐDÉSEK' => [
                'Megrendelői_szerződés' => [],
                'Szerződésmódosítások' => [],
                'Alvállalkozói_szerződések' => [],
                'Megrendelések' => [],
                'Biztosítások' => [],
            ],
            '02_TERVEK' => [
                '01_Építész' => [],
                '02_Tartószerkezet' => [],
                '03_Gépészet' => [],
                '04_Elektromos' => [],
                '05_Közmű' => [],
                '06_Tűzvédelem' => [],
                '07_Megvalósulási_tervek' => [],
                'Korábbi_tervverziók' => [],
            ],
            '03_KÖLTSÉGVETÉS' => [
                'Eredeti_költségvetés' => [],
                'Módosított_költségvetés' => [],
                'Pótmunkák' => [],
                'Költségkövetés' => [],
                'Projekt_cash-flow' => [],
            ],
            '04_BESZERZÉS' => [
                'Ajánlatkérések' => [],
                'Beérkezett_ajánlatok' => [],
                'Ajánlat_összehasonlítások' => [],
                'Megrendelések' => [],
                'Szállítólevelek' => [],
            ],
            '05_KIVITELEZÉS' => [
                'Munkaterület_átadás' => [],
                'Munkafolyamatok' => [],
                'Anyagjóváhagyások' => [],
                'Minták' => [],
                'Változáskezelés' => [],
                'Hibák_és_javítások' => [],
            ],
            '06_NAPLÓK_ÉS_JEGYZŐKÖNYVEK' => [
                'Építési_napló' => [],
                'Kooperációs_jegyzőkönyvek' => [],
                'Munkavédelmi_jegyzőkönyvek' => [],
                'Minőségellenőrzések' => [],
                'Mérések' => [],
                'Hatósági_ellenőrzések' => [],
            ],
            '07_SZÁMLÁZÁS' => [
                'Teljesítésigazolások' => [],
                'Részszámlák' => [],
                'Végszámla' => [],
                'Alvállalkozói_számlák' => [],
                'Pénzügyi_egyeztetések' => [],
            ],
            '08_FOTÓK' => [
                '01_Kezdés_előtti_állapot' => [],
                '02_Kivitelezés_közben' => [],
                '03_Takart_szerkezetek' => [],
                '04_Hibák' => [],
                '05_Elkészült_állapot' => [],
            ],
            '09_ÁTADÁS_ÁTVÉTEL' => [
                'Átadási_dokumentáció' => [],
                'Megvalósulási_tervek' => [],
                'Gépkönyvek' => [],
                'Műbizonylatok' => [],
                'Garancialevelek' => [],
                'Hibajegyzék' => [],
                'Átadás-átvételi_jegyzőkönyv' => [],
            ],
            '10_GARANCIA' => [
                'Garanciális_bejelentések' => [],
                'Hibajavítások' => [],
                'Fotók' => [],
                'Jegyzőkönyvek' => [],
                'Garancia_lejárata' => [],
            ],
        ];
    }
}
