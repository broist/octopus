<?php

namespace App\Support;

/**
 * A Tagi kölcsön / közös költségek almodul (Pénzügy §9) közös törzslistái és
 * számoló segédfüggvényei.
 */
class MemberLedger
{
    /**
     * Kezelt pénznemek. A forint a bázis: az egyenlegek mindig forintban
     * hasonlíthatók össze, a devizás tételek árfolyammal váltódnak át.
     *
     * @var array<string, string>
     */
    public const CURRENCIES = [
        'HUF' => 'HUF – forint',
        'EUR' => 'EUR – euró',
        'USD' => 'USD – amerikai dollár',
    ];

    /** @var array<string, string> */
    public const CURRENCY_SYMBOLS = [
        'HUF' => 'Ft',
        'EUR' => '€',
        'USD' => '$',
    ];

    /**
     * Közös költség kategóriái.
     *
     * @var array<string, string>
     */
    public const CATEGORIES = [
        'konyveles' => 'Könyvelés',
        'szoftver' => 'Szoftver / előfizetés',
        'bank' => 'Bank / pénzügyi díj',
        'biztositas' => 'Biztosítás',
        'ado' => 'Adó / járulék',
        'egyeb' => 'Egyéb',
    ];

    /**
     * A költség keletkezésének módja.
     *
     * @var array<string, string>
     */
    public const SOURCES = [
        'pdf' => 'Számla PDF-ből',
        'ismetlodo' => 'Ismétlődő',
        'kezi' => 'Kézi',
    ];

    /** A figyelt mappa azonosítója (Fájlkezelő) — app_settings kulcs. */
    public const SETTING_WATCH_FOLDER = 'ledger.watch_folder_id';

    /**
     * Ha a figyelt mappa nincs beállítva, ezen az útvonalon keressük meg
     * (kis-nagybetű független, a `/` a mappaszintek elválasztója).
     */
    public const DEFAULT_WATCH_PATH = 'AcuWall Kft. Belső/02_PÉNZÜGY_ÉS_KÖNYVELÉS/Konyvelo';

    /**
     * Az első indításkor felkínált tagok és részesedésük (megrendelői megadás).
     *
     * @var array<int, array{name: string, share: float}>
     */
    public const DEFAULT_MEMBERS = [
        ['name' => 'Ádám', 'share' => 30.0],
        ['name' => 'István', 'share' => 30.0],
        ['name' => 'Bence', 'share' => 20.0],
        ['name' => 'Luca', 'share' => 20.0],
    ];

    /** @var array<int, string> */
    public const MONTHS_HU = [
        1 => 'január', 2 => 'február', 3 => 'március', 4 => 'április',
        5 => 'május', 6 => 'június', 7 => 'július', 8 => 'augusztus',
        9 => 'szeptember', 10 => 'október', 11 => 'november', 12 => 'december',
    ];

    /**
     * Összeg szétosztása százalékok szerint úgy, hogy a részek összege PONTOSAN
     * a teljes összeg legyen (legnagyobb maradék módszer).
     *
     * A kerekítés egész pénznem-egységre történik forintnál, két tizedesre
     * devizánál — a maradék a legnagyobb törtrészű tételekre kerül.
     *
     * @param  array<int|string, float>  $percents  kulcs → százalék
     * @return array<int|string, float> kulcs → összeg
     */
    public static function split(float $total, array $percents, string $currency = 'HUF'): array
    {
        $sum = array_sum($percents);
        if ($sum <= 0) {
            return array_map(fn () => 0.0, $percents);
        }

        // A forint nem osztható tovább; devizánál két tizedessel számolunk.
        $scale = $currency === 'HUF' ? 1 : 100;
        $units = (int) round($total * $scale);

        $exact = [];
        $base = [];
        foreach ($percents as $key => $percent) {
            $value = $units * ($percent / $sum);
            $exact[$key] = $value;
            $base[$key] = (int) floor($value);
        }

        $remainder = $units - array_sum($base);

        // A maradék a legnagyobb levágott törtrésszel rendelkezőknek jut.
        $fractions = [];
        foreach ($exact as $key => $value) {
            $fractions[$key] = $value - floor($value);
        }
        arsort($fractions);

        foreach (array_keys($fractions) as $key) {
            if ($remainder <= 0) {
                break;
            }
            $base[$key]++;
            $remainder--;
        }

        return array_map(fn (int $u) => $u / $scale, $base);
    }

    /**
     * Az összeg forintra váltva (a forint önmaga, árfolyam nélkül).
     */
    public static function toHuf(float $amount, string $currency, float $rate): float
    {
        if ($currency === 'HUF') {
            return round($amount, 2);
        }

        return round($amount * $rate, 2);
    }

    /**
     * Magyar hónapnév → sorszám (1–12), vagy null.
     */
    public static function monthNumber(string $name): ?int
    {
        $needle = mb_strtolower(trim($name));

        foreach (self::MONTHS_HU as $number => $label) {
            // A ragozott alak is illeszkedjen: „júniusi”, „júniusban”.
            if ($needle === $label || str_starts_with($needle, $label)) {
                return $number;
            }
        }

        return null;
    }
}
