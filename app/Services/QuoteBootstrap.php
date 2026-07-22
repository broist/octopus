<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Az árajánlat-készítő induló adatai: a TERC-exportból importált munkanem- és
 * tételsablon (üres és mintaárazott változat). A forrás a
 * database/data/quote-bootstrap.json (a portolt AcuWall appból).
 */
class QuoteBootstrap
{
    private static function load(): array
    {
        return Cache::rememberForever('quote-bootstrap', function () {
            $path = database_path('data/quote-bootstrap.json');

            return is_file($path)
                ? (json_decode(file_get_contents($path), true) ?: [])
                : [];
        });
    }

    public static function meta(): array
    {
        return self::load()['meta'] ?? [];
    }

    /**
     * Üres sablon (importált munkanem/tétel-struktúra, saját árazásra várva).
     */
    public static function blankTemplate(): array
    {
        return self::load()['blankTemplate'] ?? self::minimal();
    }

    /**
     * Mintaárazott projekt (bemutató célra).
     */
    public static function sampleProject(): array
    {
        return self::load()['sampleProject'] ?? self::minimal();
    }

    /**
     * Végső tartalék, ha a JSON hiányzik: egy minimális, üres ajánlat.
     */
    private static function minimal(): array
    {
        return [
            'projectName' => 'Új árajánlat',
            'quoteNumber' => '',
            'clientName' => '',
            'status' => 'piszkozat',
            'version' => 1,
            'vatRate' => 27.0,
            'discount' => 0,
            'contingency' => 0,
            'projectCost' => 0,
            'rounding' => 0,
            'globalProfitMode' => 'markup',
            'globalProfitValue' => 0,
            'pdfMode' => 'summary',
            'showQuantitiesToCustomer' => false,
            'categories' => [],
            'payments' => [],
            'sections' => [],
        ];
    }
}
