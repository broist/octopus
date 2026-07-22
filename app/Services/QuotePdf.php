<?php

namespace App\Services;

use Mpdf\Mpdf;

/**
 * Ügyféloldali árajánlat-PDF az AcuWall arculatával.
 *
 * A fejléc és a lábléc a weboldal (acuwall.hu) sötét navy / vérnarancs
 * arculatát követi (logó, „AcuWall" szójel, „Építsünk együtt" szlogen); a
 * törzs nyomtatásbiztos fehér, hivatalos dokumentum megjelenéssel.
 *
 * Adatvédelem: a PDF SOHA nem tartalmaz belső adatot (saját/alvállalkozói
 * költség, haszonkulcs, árrés, nyereség, belső megjegyzés).
 */
class QuotePdf
{
    private const NAVY = '#011129';
    private const NAVY_HEADER = '#000B1D';
    private const ORANGE = '#F04A24';
    private const ORANGE_DARK = '#8F291B';
    private const TEXT = '#17283A';
    private const MUTED = '#5F6B76';
    private const LINE = '#D5DEE7';
    private const PANEL = '#F4F7FA';

    /**
     * @param  array<string, mixed>  $quote  A nyers ajánlat (data JSON dekódolva)
     * @return string  A PDF bináris tartalma
     */
    public static function render(array $quote, string $mode = 'summary', string $theme = 'print'): string
    {
        $totals = QuoteCalculator::project($quote);

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_left' => 15,
            'margin_right' => 15,
            'margin_top' => 34,
            'margin_bottom' => 22,
            'margin_header' => 8,
            'margin_footer' => 8,
            'tempDir' => sys_get_temp_dir(),
            'default_font' => 'dejavusans',
        ]);

        $mpdf->SetTitle('AcuWall árajánlat – '.($quote['projectName'] ?? ''));
        $mpdf->SetAuthor('AcuWall Kft.');
        $mpdf->SetHTMLHeader(self::header());
        $mpdf->SetHTMLFooter(self::footer($quote));
        $mpdf->WriteHTML(self::styles());
        $mpdf->WriteHTML(self::body($quote, $totals, $mode));

        return $mpdf->Output('', 'S');
    }

    /* ------------------------------------------------------------------ */

    private static function logoTag(): string
    {
        $path = public_path('brand/acuwall-logo.png');
        if (! is_file($path)) {
            return '';
        }
        $data = base64_encode(file_get_contents($path));

        return '<img src="data:image/png;base64,'.$data.'" width="34" height="34" />';
    }

    private static function header(): string
    {
        $orange = self::ORANGE;
        $navy = self::NAVY_HEADER;
        $logo = self::logoTag();

        // Sötét navy sáv (a weboldal arculata), hogy a fehér szöveg is látsszon.
        return <<<HTML
        <div style="background-color: {$navy}; padding: 4px 7px; border-bottom: 2px solid {$orange};">
        <table width="100%"><tr>
            <td width="44" style="vertical-align:middle;">
                <div style="border:1px solid {$orange}; padding:2px; width:36px;">{$logo}</div>
            </td>
            <td style="padding-left:4px; vertical-align:middle;">
                <span style="font-size:15pt; font-weight:bold; color:#FFFFFF;">Acu</span><span style="font-size:15pt; font-weight:bold; color:{$orange};">Wall</span><br/>
                <span style="font-size:7.5pt; font-weight:bold; color:{$orange};">Építsünk együtt</span>
            </td>
            <td style="text-align:right; vertical-align:middle;">
                <span style="font-size:6.5pt; font-weight:bold; color:{$orange}; letter-spacing:0.5px;">KULCSRAKÉSZ MEGVALÓSÍTÁS</span><br/>
                <span style="font-size:7.5pt; font-weight:bold; color:#FFFFFF;">Könnyűacélvázas és szendvicspaneles épületek</span><br/>
                <span style="font-size:6.8pt; color:#AFC0CF;">egy felelős projektvezetéssel</span>
            </td>
        </tr></table>
        </div>
        HTML;
    }

    private static function footer(array $quote): string
    {
        $orange = self::ORANGE;
        $navy = self::NAVY_HEADER;
        $number = htmlspecialchars((string) ($quote['quoteNumber'] ?? ''), ENT_QUOTES);
        $version = (int) ($quote['version'] ?? 1);

        return <<<HTML
        <div style="background-color: {$navy}; padding: 3px 7px; border-top: 1.6px solid {$orange};">
        <table width="100%"><tr>
            <td style="font-size:6.8pt; color:#AEBFCE;">
                <span style="font-weight:bold; color:#FFFFFF;">Acu</span><span style="font-weight:bold; color:{$orange};">Wall</span>
                &nbsp;|&nbsp; Építsünk együtt &nbsp;|&nbsp; acuwall.hu
            </td>
            <td style="text-align:right; font-size:6.8pt; color:#AEBFCE;">
                {$number} &nbsp;|&nbsp; v{$version} &nbsp;|&nbsp; {PAGENO}. oldal
            </td>
        </tr></table>
        </div>
        HTML;
    }

    private static function styles(): string
    {
        $orange = self::ORANGE;
        $navy = self::NAVY;
        $text = self::TEXT;
        $muted = self::MUTED;
        $line = self::LINE;
        $panel = self::PANEL;

        return <<<HTML
        <style>
            body { font-family: dejavusans, sans-serif; color: {$text}; font-size: 8.8pt; }
            h1.title { color: {$orange}; font-size: 20pt; margin: 0 0 6px 0; }
            h2.section { color: {$navy}; font-size: 11.5pt; margin: 12px 0 5px 0;
                         border-left: 3px solid {$orange}; padding-left: 6px; }
            h3.cat { color: {$navy}; font-size: 9.6pt; margin: 8px 0 3px 0; }
            table.meta { width: 100%; border-collapse: collapse; background: {$panel};
                         border: 0.5px solid {$line}; }
            table.meta td { padding: 5px 7px; font-size: 8.6pt; vertical-align: top;
                            border: 0.4px solid {$line}; }
            td.lbl { color: {$muted}; font-size: 7.6pt; width: 22%; }
            table.grid { width: 100%; border-collapse: collapse; margin-top: 2px; }
            table.grid th { background: {$orange}; color: #FFFFFF; font-size: 8pt;
                            padding: 5px 6px; text-align: left; }
            table.grid th.r, table.grid td.r { text-align: right; }
            table.grid td { border: 0.4px solid {$line}; padding: 4px 6px; font-size: 8.2pt;
                            vertical-align: top; }
            tr.sum td { background: {$panel}; font-weight: bold; }
            table.totals { width: 74%; border-collapse: collapse; margin-left: 26%; margin-top: 8px; }
            table.totals td { padding: 6px 9px; font-size: 9pt; border: 0.5px solid {$line}; }
            table.totals td.r { text-align: right; white-space: nowrap; }
            tr.grand td { background: {$navy}; color: #FFFFFF; font-weight: bold;
                          border-top: 2px solid {$orange}; }
            p.body { font-size: 8.8pt; line-height: 1.5; margin: 3px 0; }
            .muted { color: {$muted}; font-size: 7.8pt; }
            .contact-slogan { color: {$orange}; font-weight: bold; font-size: 10pt; }
        </style>
        HTML;
    }

    private static function esc(mixed $v): string
    {
        return nl2br(htmlspecialchars((string) ($v ?? ''), ENT_QUOTES));
    }

    private static function body(array $quote, array $totals, string $mode): string
    {
        $huf = fn ($v) => QuoteCalculator::formatHuf($v);
        $showQty = ! empty($quote['showQuantitiesToCustomer']);
        $html = '<h1 class="title">ÁRAJÁNLAT</h1>';

        // Fejléc-metaadatok
        $rows = [
            ['Projekt', $quote['projectName'] ?? '', 'Ajánlatszám', $quote['quoteNumber'] ?? ''],
            ['Megrendelő', $quote['clientName'] ?? '', 'Kelte', $quote['quoteDate'] ?? ''],
            ['Helyszín', $quote['location'] ?? '', 'Érvényesség', $quote['validUntil'] ?? ''],
            ['Készítette', $quote['preparedBy'] ?? '', 'Verzió', (string) ($quote['version'] ?? 1)],
        ];
        $html .= '<table class="meta">';
        foreach ($rows as [$l1, $v1, $l2, $v2]) {
            $html .= '<tr><td class="lbl">'.self::esc($l1).'</td><td>'.self::esc($v1)
                .'</td><td class="lbl">'.self::esc($l2).'</td><td>'.self::esc($v2).'</td></tr>';
        }
        $html .= '</table>';

        if (! empty($quote['description'])) {
            $html .= '<h2 class="section">PROJEKT ÖSSZEFOGLALÁSA</h2>';
            $html .= '<p class="body">'.self::esc($quote['description']).'</p>';
        }

        $html .= '<h2 class="section">AJÁNLATI TARTALOM</h2>';
        $html .= $mode === 'detailed'
            ? self::detailedContent($quote, $huf, $showQty)
            : self::summaryContent($quote, $huf);

        // Összesítés (nettó / ÁFA / bruttó)
        $vatRate = number_format((float) ($quote['vatRate'] ?? 0), 1, ',', ' ');
        $html .= '<table class="totals">'
            .'<tr><td>Nettó ajánlati összeg</td><td class="r">'.$huf($totals['netOffer']).'</td></tr>'
            .'<tr><td>ÁFA ('.$vatRate.'%)</td><td class="r">'.$huf($totals['vat']).'</td></tr>'
            .'<tr class="grand"><td>Bruttó ajánlati összeg</td><td class="r">'.$huf($totals['grossOffer']).'</td></tr>'
            .'</table>';

        // Fizetési ütemezés
        if (! empty($quote['payments'])) {
            $html .= '<h2 class="section">FIZETÉSI ÜTEMEZÉS</h2>';
            $html .= '<table class="grid"><tr><th>Mérföldkő</th><th class="r">Arány</th><th class="r">Nettó összeg</th><th>Esedékesség</th></tr>';
            foreach ($quote['payments'] as $pay) {
                $percent = (float) ($pay['percent'] ?? 0);
                $amount = $totals['netOffer'] * $percent / 100;
                $html .= '<tr><td>'.self::esc($pay['name'] ?? '').'</td>'
                    .'<td class="r">'.number_format($percent, 1, ',', ' ').'%</td>'
                    .'<td class="r">'.$huf($amount).'</td>'
                    .'<td>'.self::esc($pay['condition'] ?? '').'</td></tr>';
            }
            $html .= '</table>';
        }

        // Ajánlati feltétel-szekciók
        $sectionLabels = [
            'includes' => 'TARTALMAZZA',
            'excludes' => 'NEM TARTALMAZZA',
            'assumptions' => 'FELTÉTELEZÉSEK',
            'clientData' => 'MEGRENDELŐI ADATSZOLGÁLTATÁS',
            'openQuestions' => 'NYITOTT KÉRDÉSEK',
            'nextStep' => 'KÖVETKEZŐ LÉPÉS',
        ];
        $sections = $quote['sections'] ?? [];
        foreach ($sectionLabels as $key => $label) {
            $text = trim((string) ($sections[$key] ?? ''));
            if ($text !== '') {
                $html .= '<h2 class="section">'.$label.'</h2>';
                $html .= '<p class="body">'.self::esc($text).'</p>';
            }
        }

        // Kapcsolat
        $html .= '<h2 class="section">KAPCSOLAT</h2>'
            .'<p class="body"><b>AcuWall Kft.</b> &nbsp;|&nbsp; acuwall.hu</p>'
            .'<p class="contact-slogan">Építsünk együtt</p>'
            .'<p class="muted">Könnyűacélvázas és szendvicspaneles épületek kulcsrakészen – egy felelős '
            .'projektvezetéssel, az első ötlettől az átadásig.</p>';

        return $html;
    }

    private static function summaryContent(array $quote, callable $huf): string
    {
        $html = '<table class="grid"><tr><th>Munkanem</th><th class="r">Nettó összeg</th></tr>';
        foreach ($quote['categories'] ?? [] as $category) {
            if (! ($category['active'] ?? true)) {
                continue;
            }
            $offer = 0;
            $hasActive = false;
            foreach ($category['items'] ?? [] as $item) {
                if ($item['active'] ?? true) {
                    $hasActive = true;
                    $offer += QuoteCalculator::item($quote, $category, $item)['offer'];
                }
            }
            if ($hasActive) {
                $html .= '<tr><td>'.self::esc($category['title'] ?? '').'</td>'
                    .'<td class="r">'.$huf($offer).'</td></tr>';
            }
        }
        $html .= '</table>';

        return $html;
    }

    private static function detailedContent(array $quote, callable $huf, bool $showQty): string
    {
        $html = '';
        foreach ($quote['categories'] ?? [] as $category) {
            if (! ($category['active'] ?? true)) {
                continue;
            }
            $rows = '';
            $catOffer = 0;
            foreach ($category['items'] ?? [] as $item) {
                if (! ($item['active'] ?? true)) {
                    continue;
                }
                $calc = QuoteCalculator::item($quote, $category, $item);
                $catOffer += $calc['offer'];
                if ($showQty) {
                    $qty = rtrim(rtrim(number_format($calc['quantity'], 2, ',', ' '), '0'), ',');
                    $rows .= '<tr><td>'.self::esc($item['description'] ?? '').'</td>'
                        .'<td class="r">'.$qty.'</td>'
                        .'<td>'.self::esc($item['unit'] ?? '').'</td>'
                        .'<td class="r">'.$huf($calc['offer']).'</td></tr>';
                } else {
                    $rows .= '<tr><td>'.self::esc($item['description'] ?? '').'</td>'
                        .'<td class="r">'.$huf($calc['offer']).'</td></tr>';
                }
            }
            if ($rows === '') {
                continue;
            }
            $html .= '<h3 class="cat">'.self::esc($category['title'] ?? '').'</h3>';
            if ($showQty) {
                $html .= '<table class="grid"><tr><th>Műszaki tartalom</th><th class="r">Menny.</th>'
                    .'<th>Egység</th><th class="r">Nettó összeg</th></tr>'.$rows
                    .'<tr class="sum"><td colspan="3">Munkanem összesen</td><td class="r">'.$huf($catOffer).'</td></tr></table>';
            } else {
                $html .= '<table class="grid"><tr><th>Műszaki tartalom</th><th class="r">Nettó összeg</th></tr>'.$rows
                    .'<tr class="sum"><td>Munkanem összesen</td><td class="r">'.$huf($catOffer).'</td></tr></table>';
            }
        }

        return $html;
    }
}
