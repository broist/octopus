<?php

namespace App\Services;

use Mpdf\Mpdf;

/**
 * Riport-export (spec §15: „riportok kiexportálása PDF/Excel").
 *
 * Ugyanabból a normalizált riport-szerkezetből dolgozik, amit a képernyő is
 * kap a {@see ReportBuilder}-től, így az exportált tartalom mindig pontosan az,
 * amit a felhasználó lát (a kiválasztott oszlopokkal és szűrőkkel együtt).
 */
class ReportExport
{
    private const NAVY = '#21382E';

    private const ACCENT = '#2E6B4F';

    private const TEXT = '#2b2b28';

    private const MUTED = '#5b5b52';

    private const LINE = '#d9d4c9';

    private const CORAL = '#C0503A';

    /**
     * Excelben közvetlenül megnyitható CSV (pontosvesszős, UTF-8 BOM-mal,
     * magyar tizedesvesszővel).
     *
     * @param  array<string, mixed>  $report
     * @param  array<int, string>  $meta  Fejléc-sorok (időszak, szűrők)
     */
    public static function csv(array $report, array $meta = []): string
    {
        $out = "\xEF\xBB\xBF"; // BOM — az Excel így ismeri fel az UTF-8-at
        $out .= self::csvLine([$report['title']]);
        foreach ($meta as $line) {
            $out .= self::csvLine([$line]);
        }
        $out .= "\n";

        $columns = $report['columns'];
        $out .= self::csvLine(array_column($columns, 'label'));

        foreach ($report['rows'] as $row) {
            $out .= self::csvLine(array_map(
                fn ($column) => self::plain($row[$column['key']] ?? null, $column['format']),
                $columns,
            ));
        }

        if (! empty($report['totals'])) {
            $out .= self::csvLine(array_map(
                fn ($column) => self::plain($report['totals'][$column['key']] ?? null, $column['format']),
                $columns,
            ));
        }

        if (! empty($report['note'])) {
            $out .= "\n".self::csvLine([$report['note']]);
        }

        return $out;
    }

    /**
     * Nyomtatható PDF (fekvő A4, az összesítő csempékkel és a teljes táblával).
     *
     * @param  array<string, mixed>  $report
     * @param  array<int, string>  $meta
     */
    public static function pdf(array $report, array $meta = []): string
    {
        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4-L',
            'margin_left' => 10,
            'margin_right' => 10,
            'margin_top' => 22,
            'margin_bottom' => 16,
            'margin_header' => 7,
            'margin_footer' => 7,
            'tempDir' => sys_get_temp_dir(),
            'default_font' => 'dejavusans',
        ]);

        $mpdf->SetTitle($report['title']);
        $mpdf->SetAuthor(config('app.name'));
        $mpdf->SetHTMLHeader(self::header($report['title']));
        $mpdf->SetHTMLFooter(self::footer());
        $mpdf->WriteHTML(self::body($report, $meta));

        return $mpdf->Output('', 'S');
    }

    /* ------------------------------------------------------------------ */

    /**
     * @param  array<int, mixed>  $values
     */
    private static function csvLine(array $values): string
    {
        $cells = array_map(function ($value) {
            $value = (string) $value;

            return str_contains($value, ';') || str_contains($value, '"') || str_contains($value, "\n")
                ? '"'.str_replace('"', '""', $value).'"'
                : $value;
        }, $values);

        return implode(';', $cells)."\n";
    }

    /**
     * Nyers (mértékegység nélküli) érték az exporthoz — a szám maradjon szám.
     */
    private static function plain(mixed $value, string $format): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return match ($format) {
            'huf' => str_replace('.', ',', (string) round((float) $value, 2)),
            'num', 'pct', 'days' => str_replace('.', ',', (string) round((float) $value, 2)),
            default => (string) $value,
        };
    }

    /**
     * Megjelenítendő érték (PDF) — mértékegységgel.
     */
    private static function display(mixed $value, string $format): string
    {
        if ($value === null || $value === '') {
            return $value === '' ? '' : '—';
        }

        return match ($format) {
            'huf' => number_format((float) $value, 0, ',', ' ').' Ft',
            'pct' => rtrim(rtrim(number_format((float) $value, 1, ',', ' '), '0'), ',').'%',
            'days' => rtrim(rtrim(number_format((float) $value, 1, ',', ' '), '0'), ',').' nap',
            'num' => rtrim(rtrim(number_format((float) $value, 1, ',', ' '), '0'), ','),
            default => (string) $value,
        };
    }

    private static function header(string $title): string
    {
        $navy = self::NAVY;

        return '<div style="background-color: '.$navy.'; color: #ffffff; padding: 5px 8px; font-size: 10pt;">'
            .'<b>'.e($title).'</b>'
            .'<span style="float: right; font-size: 8pt; color: #cfded5;">'.e(config('app.name')).'</span>'
            .'</div>';
    }

    private static function footer(): string
    {
        return '<div style="border-top: 0.5px solid '.self::LINE.'; padding-top: 3px; font-size: 7.5pt; color: '.self::MUTED.';">'
            .'Készült: '.now()->format('Y.m.d. H:i')
            .'<span style="float: right;">{PAGENO} / {nbpg}</span>'
            .'</div>';
    }

    /**
     * @param  array<string, mixed>  $report
     * @param  array<int, string>  $meta
     */
    private static function body(array $report, array $meta): string
    {
        $html = '<style>
            body { font-family: dejavusans; font-size: 8pt; color: '.self::TEXT.'; }
            h1 { font-size: 13pt; margin: 0 0 2mm 0; color: '.self::NAVY.'; }
            .meta { font-size: 7.5pt; color: '.self::MUTED.'; margin-bottom: 3mm; }
            table.data { width: 100%; border-collapse: collapse; }
            table.data th { background-color: #eef2ef; color: '.self::NAVY.'; font-size: 7.5pt;
                text-align: left; padding: 1.6mm 1.6mm; border-bottom: 0.6px solid '.self::LINE.'; }
            table.data td { padding: 1.4mm 1.6mm; border-bottom: 0.4px solid #efece5; font-size: 8pt; }
            table.data tr.totals td { font-weight: bold; border-top: 0.8px solid '.self::LINE.'; background-color: #f7f5f0; }
            .r { text-align: right; }
            .bad { color: '.self::CORAL.'; }
            table.cards { width: 100%; border-collapse: separate; border-spacing: 2mm 0; margin-bottom: 3mm; }
            table.cards td { border: 0.5px solid '.self::LINE.'; padding: 2mm; }
            .card-value { font-size: 11pt; font-weight: bold; color: '.self::ACCENT.'; }
            .card-label { font-size: 7pt; color: '.self::MUTED.'; }
            .note { margin-top: 3mm; font-size: 7pt; color: '.self::MUTED.'; }
        </style>';

        $html .= '<h1>'.e($report['title']).'</h1>';
        $html .= '<div class="meta">'.e(implode(' • ', $meta)).'</div>';

        if (! empty($report['summary'])) {
            $html .= '<table class="cards"><tr>';
            foreach ($report['summary'] as $card) {
                $value = self::display($card['value'], $card['format']);
                $class = ($card['tone'] ?? null) === 'bad' ? ' class="bad"' : '';
                $html .= '<td><div class="card-value"'.$class.'>'.e($value).'</div>'
                    .'<div class="card-label">'.e($card['label']).'</div></td>';
            }
            $html .= '</tr></table>';
        }

        $columns = $report['columns'];

        $html .= '<table class="data"><thead><tr>';
        foreach ($columns as $column) {
            $align = $column['align'] === 'right' ? ' class="r"' : '';
            $html .= '<th'.$align.'>'.e($column['label']).'</th>';
        }
        $html .= '</tr></thead><tbody>';

        if ($report['rows'] === []) {
            $html .= '<tr><td colspan="'.count($columns).'">Nincs megjeleníthető adat.</td></tr>';
        }

        foreach ($report['rows'] as $row) {
            $bad = ($row['_tone'] ?? null) === 'bad';
            $html .= '<tr>';
            foreach ($columns as $column) {
                $align = $column['align'] === 'right' ? ' r' : '';
                $class = trim($align.($bad ? ' bad' : ''));
                $html .= '<td'.($class !== '' ? ' class="'.$class.'"' : '').'>'
                    .e(self::display($row[$column['key']] ?? null, $column['format'])).'</td>';
            }
            $html .= '</tr>';
        }

        if (! empty($report['totals'])) {
            $html .= '<tr class="totals">';
            foreach ($columns as $column) {
                $align = $column['align'] === 'right' ? ' class="r"' : '';
                $html .= '<td'.$align.'>'.e(self::display($report['totals'][$column['key']] ?? null, $column['format'])).'</td>';
            }
            $html .= '</tr>';
        }

        $html .= '</tbody></table>';

        if (! empty($report['note'])) {
            $html .= '<div class="note">'.e($report['note']).'</div>';
        }

        return $html;
    }
}
