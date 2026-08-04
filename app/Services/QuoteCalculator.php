<?php

namespace App\Services;

/**
 * Árajánlat-kalkulátor — az AcuWall Python-app számítási motorjának hű portja.
 *
 * Minden összeg egész HUF, fél-fel kerekítéssel (Excel-kompatibilis). A
 * haszonkulcs három szinten örökölhető: tétel → munkanem → globális; a mód
 * lehet 'markup' (%), 'multiplier' (szorzó) vagy 'fixed' (fix végösszeg).
 *
 * A bemenet a nyers ajánlat-tömb (a `data` JSON dekódolva); a kimenet nem
 * tartalmaz állapotot, tisztán számított értékek.
 */
class QuoteCalculator
{
    private static function num(mixed $value, float $default = 0.0): float
    {
        if ($value === null || $value === '') {
            return $default;
        }

        return is_numeric($value) ? (float) $value : $default;
    }

    /** Fél-fel kerekítés egész HUF-ra. */
    private static function round(float $value): int
    {
        return (int) round($value, 0, PHP_ROUND_HALF_UP);
    }

    private static function multiply(mixed $a, mixed $b): int
    {
        return self::round(self::num($a) * self::num($b));
    }

    /**
     * A tételre ténylegesen érvényes haszonkulcs (öröklődés feloldva).
     *
     * @return array{0:string,1:float}  [mód, érték]
     */
    public static function effectiveProfit(array $project, array $category, array $item): array
    {
        if (! empty($item['profitOverride'])) {
            return [$item['profitMode'] ?? 'markup', self::num($item['profitValue'] ?? 0)];
        }
        if (! empty($category['profitOverride'])) {
            return [$category['profitMode'] ?? 'markup', self::num($category['profitValue'] ?? 0)];
        }

        return [$project['globalProfitMode'] ?? 'markup', self::num($project['globalProfitValue'] ?? 0)];
    }

    /**
     * Egy tétel teljes kalkulációja.
     *
     * @return array<string, float|int>
     */
    public static function item(array $project, array $category, array $item): array
    {
        $qty = self::num($item['quantity'] ?? 0);
        $ownMaterial = self::multiply($qty, $item['ownMaterialUnit'] ?? 0);
        $ownLabor = self::multiply($qty, $item['ownLaborUnit'] ?? 0);
        $ownCost = $ownMaterial + $ownLabor;
        $subMaterial = self::multiply($qty, $item['subMaterialUnit'] ?? 0);
        $subLabor = self::multiply($qty, $item['subLaborUnit'] ?? 0);
        $subCost = $subMaterial + $subLabor;

        $basis = $item['basis'] ?? 'own';
        $base = match ($basis) {
            'sub' => $subCost,
            'manual' => self::round(self::num($item['manualBase'] ?? 0)),
            default => $ownCost,
        };

        [$mode, $value] = self::effectiveProfit($project, $category, $item);
        $offer = match ($mode) {
            'multiplier' => self::round($base * $value),
            'fixed' => self::round($value),
            default => self::round($base * (1 + $value / 100)),
        };

        $profit = $offer - $base;
        $margin = $offer ? $profit / $offer * 100 : 0.0;
        $markup = $base ? $profit / $base * 100 : 0.0;

        [$offerMaterial, $offerLabor] = self::splitOffer($item, $offer, $ownMaterial, $ownLabor, $subMaterial, $subLabor);

        return [
            'quantity' => $qty,
            'ownMaterial' => $ownMaterial,
            'ownLabor' => $ownLabor,
            'ownCost' => $ownCost,
            'subMaterial' => $subMaterial,
            'subLabor' => $subLabor,
            'subCost' => $subCost,
            'base' => $base,
            'offer' => $offer,
            'offerMaterial' => $offerMaterial,
            'offerLabor' => $offerLabor,
            'profit' => $profit,
            'margin' => $margin,
            'markup' => $markup,
        ];
    }

    /**
     * Az ügyfélnek mutatott anyag/díj bontás — a HASZONNAL NÖVELT ajánlati áron.
     *
     * A haszonkulcs a teljes tételre vonatkozik, ezért az ajánlati árat a
     * költségalap anyag–munkadíj arányában osztjuk ketté; a maradékot a díjra
     * tesszük, így a két szám összege fillérre az ajánlati ár (a PDF-ben az
     * „Anyag összesen” + „Díj összesen” mindig kiadja a „Nettó összeg”-et).
     *
     * Manuális alapnál a saját egységárak arányát használjuk viszonyítási
     * alapként; ha az sincs kitöltve, az egész összeg díj (nincs elszámolt anyag).
     *
     * @return array{0:int,1:int}  [anyag, díj]
     */
    private static function splitOffer(
        array $item,
        int $offer,
        int $ownMaterial,
        int $ownLabor,
        int $subMaterial,
        int $subLabor,
    ): array {
        $isSub = ($item['basis'] ?? 'own') === 'sub';
        $material = $isSub ? $subMaterial : $ownMaterial;
        $labor = $isSub ? $subLabor : $ownLabor;
        $reference = $material + $labor;

        $offerMaterial = $reference !== 0 ? self::round($offer * $material / $reference) : 0;

        return [$offerMaterial, $offer - $offerMaterial];
    }

    /**
     * A teljes ajánlat összesítése (aktív munkanemek és tételek alapján).
     *
     * @return array<string, mixed>
     */
    public static function project(array $project): array
    {
        $ownMaterial = $ownLabor = $subCost = $baseCost = $itemOffer = 0;
        $offerMaterial = $offerLabor = 0;
        $categoryTotals = [];

        foreach ($project['categories'] ?? [] as $category) {
            if (! ($category['active'] ?? true)) {
                continue;
            }
            $ct = [
                'id' => $category['id'] ?? null,
                'title' => $category['title'] ?? '',
                'base' => 0,
                'offer' => 0,
                'offerMaterial' => 0,
                'offerLabor' => 0,
                'profit' => 0,
            ];
            foreach ($category['items'] ?? [] as $item) {
                if (! ($item['active'] ?? true)) {
                    continue;
                }
                $c = self::item($project, $category, $item);
                $ownMaterial += $c['ownMaterial'];
                $ownLabor += $c['ownLabor'];
                $subCost += $c['subCost'];
                $baseCost += $c['base'];
                $itemOffer += $c['offer'];
                $offerMaterial += $c['offerMaterial'];
                $offerLabor += $c['offerLabor'];
                $ct['base'] += $c['base'];
                $ct['offer'] += $c['offer'];
                $ct['offerMaterial'] += $c['offerMaterial'];
                $ct['offerLabor'] += $c['offerLabor'];
                $ct['profit'] += $c['profit'];
            }
            $categoryTotals[] = $ct;
        }

        $discount = self::round(self::num($project['discount'] ?? 0));
        $contingency = self::round(self::num($project['contingency'] ?? 0));
        $projectCost = self::round(self::num($project['projectCost'] ?? 0));
        $rounding = self::round(self::num($project['rounding'] ?? 0));
        $netOffer = self::round($itemOffer - $discount + $contingency + $projectCost + $rounding);
        $vatRate = self::num($project['vatRate'] ?? 0);
        $vat = self::round($netOffer * $vatRate / 100);
        $gross = $netOffer + $vat;
        $profit = $netOffer - $baseCost;

        // A projektszintű korrekciók (kedvezmény, tartalék, projektköltség,
        // kerekítés) nem tételhez kötöttek, ezért a tételek anyag–díj arányában
        // oszlanak szét — a maradék a díjra kerül, hogy a két szám összege
        // pontosan a nettó ajánlati összeg legyen.
        $netMaterial = $itemOffer !== 0 ? self::round($netOffer * $offerMaterial / $itemOffer) : 0;

        return [
            'ownMaterial' => $ownMaterial,
            'ownLabor' => $ownLabor,
            'subCost' => $subCost,
            'baseCost' => $baseCost,
            'itemOffer' => $itemOffer,
            'offerMaterial' => $offerMaterial,
            'offerLabor' => $offerLabor,
            'discount' => $discount,
            'contingency' => $contingency,
            'projectCost' => $projectCost,
            'rounding' => $rounding,
            'netOffer' => $netOffer,
            'netMaterial' => $netMaterial,
            'netLabor' => $netOffer - $netMaterial,
            'vat' => $vat,
            'grossOffer' => $gross,
            'profit' => $profit,
            'margin' => $netOffer ? $profit / $netOffer * 100 : 0.0,
            'markup' => $baseCost ? $profit / $baseCost * 100 : 0.0,
            'categoryTotals' => $categoryTotals,
        ];
    }

    public static function formatHuf(float|int $value): string
    {
        return number_format((float) round($value), 0, ',', ' ').' Ft';
    }
}
