<?php

namespace App\Services;

use App\Support\MemberLedger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;
use Smalot\PdfParser\Parser as PdfParser;
use Throwable;

/**
 * Bejövő (könyvelői) számla PDF kiolvasása.
 *
 * A havi könyvelői számla Számlázz.hu-val készül, tehát valódi szöveget
 * tartalmaz — nem képet. A kiolvasás ezért tisztán PHP-ból megy
 * (smalot/pdfparser), külön rendszerszintű csomag nélkül.
 *
 * A minta, amire épít (a megrendelő által küldött számla):
 *
 *   Sorszám: E-YRT-2026-67
 *   Kiállítás dátuma: 2026.07.20.   Fizetési határidő: 2026.07.28.
 *   Összesen: 82 550 Ft   |   áfa 27 %: 17 550
 *   Elszámolás időszaka: 2026. június hónap.
 *
 * Minden mező hiánytűrő: amit nem sikerül kiolvasni, azt a hívó „ellenőrizendő”
 * jelzéssel viszi tovább, hogy a felületen pótolható legyen. Egyedül a végösszeg
 * kötelező — anélkül nem számla, és nem is keletkezik sor.
 */
class AccountingInvoiceParser
{
    /**
     * Kiolvasás egy PDF fájlból.
     *
     * @return array<string, mixed>|null null, ha a fájl nem olvasható PDF
     */
    public function parseFile(string $absolutePath): ?array
    {
        $text = $this->extractText($absolutePath);

        return $text === null ? null : $this->parseText($text);
    }

    /**
     * A PDF szöveges tartalma (null, ha nem sikerült).
     */
    public function extractText(string $absolutePath): ?string
    {
        try {
            $document = (new PdfParser)->parseFile($absolutePath);

            return $document->getText();
        } catch (Throwable $e) {
            Log::warning('Számla PDF kiolvasása sikertelen', [
                'path' => $absolutePath,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * A számla adatai a kiolvasott szövegből.
     *
     * @return array{
     *     invoice_number: ?string, supplier_name: ?string, currency: string,
     *     gross: ?float, net: ?float, vat: ?float, issued_on: ?string,
     *     due_on: ?string, period_month: ?string, category: string,
     *     title: string, missing: array<int, string>
     * }
     */
    public function parseText(string $raw): array
    {
        $text = $this->normalize($raw);

        $currency = $this->currency($text);
        $gross = $this->gross($text, $currency);
        $vat = $this->amountAfter($text, 'áfa\s*\d+(?:[.,]\d+)?\s*%\s*:?\s*');
        $net = $this->net($text, $gross, $vat);

        $issued = $this->dateAfter($text, 'Kiállítás\s*dátuma:?\s*');
        $due = $this->dateAfter($text, 'Fizetési\s*határidő:?\s*');
        $period = $this->period($text, $issued);

        $supplier = $this->supplier($text);
        [$category, $title] = $this->classify($text, $period, $supplier);

        $missing = [];
        if ($gross === null) {
            $missing[] = 'végösszeg';
        }
        if ($due === null) {
            $missing[] = 'fizetési határidő';
        }
        if ($period === null) {
            $missing[] = 'elszámolási időszak';
        }

        return [
            'invoice_number' => $this->invoiceNumber($text),
            'supplier_name' => $supplier,
            'currency' => $currency,
            'gross' => $gross,
            'net' => $net,
            'vat' => $vat,
            'issued_on' => $issued?->toDateString(),
            'due_on' => $due?->toDateString(),
            'period_month' => $period?->toDateString(),
            'category' => $category,
            'title' => $title,
            'missing' => $missing,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Mezőnkénti kiolvasás */
    /* ------------------------------------------------------------------ */

    /**
     * A nem törhető szóköz és a többféle whitespace egységesítése — enélkül a
     * „82 550” ezres tagolása nem illeszkedne a mintákra.
     */
    private function normalize(string $text): string
    {
        $text = str_replace(["\xC2\xA0", "\xE2\x80\xAF", "\xE2\x80\x89"], ' ', $text);
        $text = (string) preg_replace('/[ \t]+/u', ' ', $text);

        return (string) preg_replace('/\R/u', "\n", $text);
    }

    private function currency(string $text): string
    {
        if (preg_match('/\b(EUR)\b|€/u', $text)) {
            return 'EUR';
        }

        if (preg_match('/\b(USD)\b/u', $text)) {
            return 'USD';
        }

        return 'HUF';
    }

    /**
     * A bruttó végösszeg. A számlán több „Összesen” is szerepel (a tétel-tábla
     * sora és a kiemelt végösszeg), ezért a pénznem-jelöléssel lezárt UTOLSÓ
     * találat a mérvadó.
     */
    private function gross(string $text, string $currency): ?float
    {
        $symbol = match ($currency) {
            'EUR' => '(?:€|EUR)',
            'USD' => '(?:\$|USD)',
            default => '(?:Ft|HUF)',
        };

        if (preg_match_all('/Összesen:?\s*([\d][\d .,]*?)\s*'.$symbol.'/ui', $text, $m)) {
            return $this->money(end($m[1]));
        }

        // Pénznem-jelölés nélkül: az „Összesen” sor legnagyobb száma.
        if (preg_match_all('/Összesen:?([^\n]*)/ui', $text, $m)) {
            $best = null;
            foreach ($m[1] as $line) {
                if (preg_match_all('/[\d][\d .,]*/u', $line, $numbers)) {
                    foreach ($numbers[0] as $number) {
                        $value = $this->money($number);
                        if ($value !== null && ($best === null || $value > $best)) {
                            $best = $value;
                        }
                    }
                }
            }

            return $best;
        }

        return null;
    }

    private function net(string $text, ?float $gross, ?float $vat): ?float
    {
        if ($nettoLabelled = $this->amountAfter($text, 'Nettó\s*(?:ár|érték|összeg):?\s*')) {
            return $nettoLabelled;
        }

        if ($gross !== null && $vat !== null) {
            return round($gross - $vat, 2);
        }

        return null;
    }

    /**
     * Az adott felirat UTÁN álló első pénzösszeg.
     *
     * @param  string  $label  határolók nélküli minta-részlet
     */
    private function amountAfter(string $text, string $label): ?float
    {
        return preg_match('/'.$label.'([\d][\d .,]*)/ui', $text, $m)
            ? $this->money($m[1])
            : null;
    }

    /**
     * Az adott felirat UTÁN álló első dátum (év, hó, nap sorrendben).
     *
     * @param  string  $label  határolók nélküli minta-részlet
     */
    private function dateAfter(string $text, string $label): ?CarbonImmutable
    {
        if (! preg_match('/'.$label.'(\d{4})[.\-\/ ]\s*(\d{1,2})[.\-\/ ]\s*(\d{1,2})/ui', $text, $m)) {
            return null;
        }

        return $this->safeDate((int) $m[1], (int) $m[2], (int) $m[3]);
    }

    /**
     * Elszámolási időszak: „2026. június hónap.” vagy dátumtartomány. Ha egyik
     * sincs, a kiállítás dátumát megelőző hónap (a könyvelői számla a lezárt
     * hónapról szól).
     */
    private function period(string $text, ?CarbonImmutable $issued): ?CarbonImmutable
    {
        if (preg_match('/Elszámolás\s*időszaka:?\s*(\d{4})\.?\s*([^\s.,;0-9]+)/ui', $text, $m)) {
            $month = MemberLedger::monthNumber($m[2]);
            if ($month !== null) {
                return $this->safeDate((int) $m[1], $month, 1);
            }
        }

        if (preg_match('/Elszámolás\s*időszaka:?\s*(\d{4})[.\-\/ ]\s*(\d{1,2})/ui', $text, $m)) {
            return $this->safeDate((int) $m[1], (int) $m[2], 1);
        }

        return $issued?->subMonthNoOverflow()->startOfMonth();
    }

    private function invoiceNumber(string $text): ?string
    {
        // A negatív lookbehind fontos: enélkül a „Bankszámlaszám” is illeszkedne
        // a „Számlaszám”-ra, és a bankszámla számát vennénk sorszámnak.
        $pattern = '/(?<!\p{L})(?:Sorszám|Számlaszám|Bizonylatszám):?\s*([A-Z0-9][A-Z0-9\-\/.]{2,40})/ui';

        if (preg_match($pattern, $text, $m)) {
            return trim($m[1], '.-/');
        }

        return null;
    }

    /**
     * A kiállító neve: az első cégformával végződő sor (a vevő adatai a
     * számlán mindig lejjebb vannak).
     */
    private function supplier(string $text): ?string
    {
        if (preg_match('/^\s*([^\n]{2,80}?\s(?:Kft|Bt|Zrt|Nyrt|Kkt|Ev|E\.V)\.?)\s*$/mui', $text, $m)) {
            return trim($m[1]);
        }

        return null;
    }

    /**
     * Kategória és megnevezés a számla tartalmából.
     *
     * @return array{0: string, 1: string}
     */
    private function classify(string $text, ?CarbonImmutable $period, ?string $supplier): array
    {
        $periodLabel = $period
            ? $period->year.'. '.MemberLedger::MONTHS_HU[$period->month]
            : null;

        if (preg_match('/könyvelés|könyvelési\s*díj/ui', $text)) {
            return ['konyveles', 'Könyvelési díj'.($periodLabel ? " – {$periodLabel}" : '')];
        }

        $base = $supplier ?: 'Bejövő számla';

        return ['egyeb', $base.($periodLabel ? " – {$periodLabel}" : '')];
    }

    /* ------------------------------------------------------------------ */
    /* Segédek */
    /* ------------------------------------------------------------------ */

    /**
     * „82 550”, „82.550”, „82 550,00” → 82550.0
     */
    private function money(string $raw): ?float
    {
        $value = trim($raw);
        $value = (string) preg_replace('/\s/u', '', $value);

        // Tizedes elválasztó a vessző; a pont ezres tagolás (pl. 82.550).
        $value = str_replace('.', '', $value);
        $value = str_replace(',', '.', $value);

        if (! is_numeric($value)) {
            return null;
        }

        return round((float) $value, 2);
    }

    private function safeDate(int $year, int $month, int $day): ?CarbonImmutable
    {
        if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12 || $day < 1 || $day > 31) {
            return null;
        }

        try {
            return CarbonImmutable::create($year, $month, $day)?->startOfDay();
        } catch (Throwable) {
            return null;
        }
    }
}
