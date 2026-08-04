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
     * Rögzített oszlopszélességek. Az mPDF-nek a táblázat MINDEN cellájára ki kell
     * írni a width-et, különben a tartalom hossza alapján méretezi az oszlopokat,
     * és munkanemenként más helyre esnek ugyanazok az oszlopok.
     */
    private const COLS_QTY = ['31%', '9%', '8%', '17%', '17%', '18%'];  // tartalom | menny. | egység | anyag | díj | összeg
    private const COLS_PLAIN = ['40%', '20%', '20%', '20%'];            // tartalom | anyag | díj | összeg
    private const COLS_PAY = ['38%', '12%', '22%', '28%'];              // mérföldkő | arány | összeg | esedékesség

    /** Cellanyitó tag a rögzített szélességgel: <td width="22%" class="r num"> */
    private static function cell(string $tag, string $width, string $class = ''): string
    {
        return '<'.$tag.' width="'.$width.'"'.($class !== '' ? ' class="'.$class.'"' : '').'>';
    }

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
            /* Az mPDF nem ismeri a table-layout / colgroup szabályokat: az oszlopok
               szélességét kizárólag a cellákra írt width adja (lásd COL_* konstansok). */
            table.grid { width: 100%; border-collapse: collapse; margin-top: 2px; }
            table.grid th { background: {$orange}; color: #FFFFFF; font-size: 8pt;
                            padding: 5px 4px; text-align: left; }
            table.grid th.r, table.grid td.r { text-align: right; }
            table.grid th.c, table.grid td.c { text-align: center; }
            table.grid td { border: 0.4px solid {$line}; padding: 4px 4px; font-size: 8.2pt;
                            vertical-align: top; }
            table.grid td.num { white-space: nowrap; }
            tr.sum td { background: {$panel}; font-weight: bold; }
            table.totals { width: 74%; border-collapse: collapse; margin-left: 26%; margin-top: 8px; }
            table.totals td { padding: 6px 9px; font-size: 9pt; border: 0.5px solid {$line}; }
            table.totals td.r { text-align: right; white-space: nowrap; }
            /* Anyag/díj bontás: halkabb kísérősor a nettó végösszeg fölött. */
            tr.split td { background: {$panel}; color: {$muted}; font-size: 8.4pt; padding: 4px 9px; }
            tr.net td { font-weight: bold; border-top: 0.8px solid {$muted}; }
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

        // Összesítés — a nettó végösszeg anyag/díj bontásával (a két sor összege
        // pontosan a nettó ajánlati összeg).
        $vatRate = number_format((float) ($quote['vatRate'] ?? 0), 1, ',', ' ');
        $html .= '<table class="totals">'
            .'<tr class="split"><td>Ebből anyag összesen (nettó)</td><td class="r">'.$huf($totals['netMaterial']).'</td></tr>'
            .'<tr class="split"><td>Ebből díj összesen (nettó)</td><td class="r">'.$huf($totals['netLabor']).'</td></tr>'
            .'<tr class="net"><td>Nettó ajánlati összeg</td><td class="r">'.$huf($totals['netOffer']).'</td></tr>'
            .'<tr><td>ÁFA ('.$vatRate.'%)</td><td class="r">'.$huf($totals['vat']).'</td></tr>'
            .'<tr class="grand"><td>Bruttó ajánlati összeg</td><td class="r">'.$huf($totals['grossOffer']).'</td></tr>'
            .'</table>';

        // Fizetési ütemezés
        if (! empty($quote['payments'])) {
            $html .= '<h2 class="section">FIZETÉSI ÜTEMEZÉS</h2>';
            [$wName, $wPct, $wAmount, $wDue] = self::COLS_PAY;
            $html .= '<table class="grid"><tr>'
                .self::cell('th', $wName).'Mérföldkő</th>'
                .self::cell('th', $wPct, 'r').'Arány</th>'
                .self::cell('th', $wAmount, 'r').'Nettó összeg</th>'
                .self::cell('th', $wDue).'Esedékesség</th></tr>';
            foreach ($quote['payments'] as $pay) {
                $percent = (float) ($pay['percent'] ?? 0);
                $amount = $totals['netOffer'] * $percent / 100;
                $html .= '<tr>'.self::cell('td', $wName).self::esc($pay['name'] ?? '').'</td>'
                    .self::cell('td', $wPct, 'r num').number_format($percent, 1, ',', ' ').'%</td>'
                    .self::cell('td', $wAmount, 'r num').$huf($amount).'</td>'
                    .self::cell('td', $wDue).self::esc($pay['condition'] ?? '').'</td></tr>';
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
        [$wDesc, $wMat, $wLab, $wAmount] = self::COLS_PLAIN;
        $html = '<table class="grid"><tr>'
            .self::cell('th', $wDesc).'Munkanem</th>'
            .self::cell('th', $wMat, 'r').'Anyag összesen</th>'
            .self::cell('th', $wLab, 'r').'Díj összesen</th>'
            .self::cell('th', $wAmount, 'r').'Nettó összeg</th></tr>';
        foreach ($quote['categories'] ?? [] as $category) {
            if (! ($category['active'] ?? true)) {
                continue;
            }
            $offer = $material = $labor = 0;
            $hasActive = false;
            foreach ($category['items'] ?? [] as $item) {
                if ($item['active'] ?? true) {
                    $hasActive = true;
                    $calc = QuoteCalculator::item($quote, $category, $item);
                    $offer += $calc['offer'];
                    $material += $calc['offerMaterial'];
                    $labor += $calc['offerLabor'];
                }
            }
            if ($hasActive) {
                $html .= '<tr>'.self::cell('td', $wDesc).self::esc($category['title'] ?? '').'</td>'
                    .self::cell('td', $wMat, 'r num').$huf($material).'</td>'
                    .self::cell('td', $wLab, 'r num').$huf($labor).'</td>'
                    .self::cell('td', $wAmount, 'r num').$huf($offer).'</td></tr>';
            }
        }
        $html .= '</table>';

        return $html;
    }

    private static function detailedContent(array $quote, callable $huf, bool $showQty): string
    {
        $html = '';
        [$wDesc, $wQty, $wUnit, $wMat, $wLab, $wAmount] = self::COLS_QTY;
        [$wDescPlain, $wMatPlain, $wLabPlain, $wAmountPlain] = self::COLS_PLAIN;
        foreach ($quote['categories'] ?? [] as $category) {
            if (! ($category['active'] ?? true)) {
                continue;
            }
            $rows = '';
            $catOffer = $catMaterial = $catLabor = 0;
            foreach ($category['items'] ?? [] as $item) {
                if (! ($item['active'] ?? true)) {
                    continue;
                }
                $calc = QuoteCalculator::item($quote, $category, $item);
                $catOffer += $calc['offer'];
                $catMaterial += $calc['offerMaterial'];
                $catLabor += $calc['offerLabor'];
                if ($showQty) {
                    $qty = rtrim(rtrim(number_format($calc['quantity'], 2, ',', ' '), '0'), ',');
                    $rows .= '<tr>'.self::cell('td', $wDesc).self::esc($item['description'] ?? '').'</td>'
                        .self::cell('td', $wQty, 'r num').$qty.'</td>'
                        .self::cell('td', $wUnit, 'c').self::esc($item['unit'] ?? '').'</td>'
                        .self::cell('td', $wMat, 'r num').$huf($calc['offerMaterial']).'</td>'
                        .self::cell('td', $wLab, 'r num').$huf($calc['offerLabor']).'</td>'
                        .self::cell('td', $wAmount, 'r num').$huf($calc['offer']).'</td></tr>';
                } else {
                    $rows .= '<tr>'.self::cell('td', $wDescPlain).self::esc($item['description'] ?? '').'</td>'
                        .self::cell('td', $wMatPlain, 'r num').$huf($calc['offerMaterial']).'</td>'
                        .self::cell('td', $wLabPlain, 'r num').$huf($calc['offerLabor']).'</td>'
                        .self::cell('td', $wAmountPlain, 'r num').$huf($calc['offer']).'</td></tr>';
                }
            }
            if ($rows === '') {
                continue;
            }
            $html .= '<h3 class="cat">'.self::esc($category['title'] ?? '').'</h3>';
            if ($showQty) {
                $html .= '<table class="grid"><tr>'
                    .self::cell('th', $wDesc).'Műszaki tartalom</th>'
                    .self::cell('th', $wQty, 'r').'Menny.</th>'
                    .self::cell('th', $wUnit, 'c').'Egység</th>'
                    .self::cell('th', $wMat, 'r').'Anyag összesen</th>'
                    .self::cell('th', $wLab, 'r').'Díj összesen</th>'
                    .self::cell('th', $wAmount, 'r').'Nettó összeg</th></tr>'.$rows
                    .'<tr class="sum"><td colspan="3">Munkanem összesen</td>'
                    .self::cell('td', $wMat, 'r num').$huf($catMaterial).'</td>'
                    .self::cell('td', $wLab, 'r num').$huf($catLabor).'</td>'
                    .self::cell('td', $wAmount, 'r num').$huf($catOffer).'</td></tr></table>';
            } else {
                $html .= '<table class="grid"><tr>'
                    .self::cell('th', $wDescPlain).'Műszaki tartalom</th>'
                    .self::cell('th', $wMatPlain, 'r').'Anyag összesen</th>'
                    .self::cell('th', $wLabPlain, 'r').'Díj összesen</th>'
                    .self::cell('th', $wAmountPlain, 'r').'Nettó összeg</th></tr>'.$rows
                    .'<tr class="sum">'.self::cell('td', $wDescPlain).'Munkanem összesen</td>'
                    .self::cell('td', $wMatPlain, 'r num').$huf($catMaterial).'</td>'
                    .self::cell('td', $wLabPlain, 'r num').$huf($catLabor).'</td>'
                    .self::cell('td', $wAmountPlain, 'r num').$huf($catOffer).'</td></tr></table>';
            }
        }

        return $html;
    }
}
