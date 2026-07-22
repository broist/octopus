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
            'profit' => $profit,
            'margin' => $margin,
            'markup' => $markup,
        ];
    }

    /**
     * A teljes ajánlat összesítése (aktív munkanemek és tételek alapján).
     *
     * @return array<string, mixed>
     */
    public static function project(array $project): array
    {
        $ownMaterial = $ownLabor = $subCost = $baseCost = $itemOffer = 0;
        $categoryTotals = [];

        foreach ($project['categories'] ?? [] as $category) {
            if (! ($category['active'] ?? true)) {
                continue;
            }
            $ct = ['id' => $category['id'] ?? null, 'title' => $category['title'] ?? '', 'base' => 0, 'offer' => 0, 'profit' => 0];
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
                $ct['base'] += $c['base'];
                $ct['offer'] += $c['offer'];
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

        return [
            'ownMaterial' => $ownMaterial,
            'ownLabor' => $ownLabor,
            'subCost' => $subCost,
            'baseCost' => $baseCost,
            'itemOffer' => $itemOffer,
            'discount' => $discount,
            'contingency' => $contingency,
            'projectCost' => $projectCost,
            'rounding' => $rounding,
            'netOffer' => $netOffer,
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
