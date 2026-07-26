import { fmtDate } from '@/lib/format';

/** A backend (ReportBuilder) normalizált riport-szerkezete. */
export type ReportFormat = 'text' | 'huf' | 'num' | 'pct' | 'days' | 'date';

export interface ReportColumn {
    key: string;
    label: string;
    format: ReportFormat;
    align: 'left' | 'right';
}

export interface ReportCard {
    label: string;
    value: number | string | null;
    format: ReportFormat;
    tone: 'good' | 'bad' | 'warn' | null;
}

export interface ReportSeries {
    label: string;
    format: ReportFormat;
    values: number[];
}

export interface ReportChartData {
    title: string;
    labels: string[];
    series: ReportSeries[];
}

export type ReportRow = Record<string, unknown> & {
    _link?: string | null;
    _tone?: 'good' | 'bad' | 'warn' | null;
};

export interface ReportData {
    key: string;
    title: string;
    subtitle: string;
    group: string;
    range: { from: string | null; to: string | null };
    summary: ReportCard[];
    columns: ReportColumn[];
    rows: ReportRow[];
    totals: ReportRow | null;
    chart: ReportChartData | null;
    note: string | null;
}

export interface ReportDefinition {
    label: string;
    title: string;
    subtitle: string;
    filters: string[];
    groups: Record<string, string>;
    default_group: string | null;
    default_period: string;
}

const num = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 });

/** Egy cella / csempe megjelenítendő értéke a formátuma szerint. */
export function fmtValue(value: unknown, format: ReportFormat): string {
    if (value === null || value === undefined) return '—';
    if (value === '') return '';
    if (format === 'text') return String(value);
    if (format === 'date') return value === '—' ? '—' : fmtDate(String(value));

    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return String(value);

    switch (format) {
        case 'huf':
            return `${int.format(Math.round(n))} Ft`;
        case 'pct':
            return `${num.format(n)}%`;
        case 'days':
            return `${num.format(n)} nap`;
        default:
            return num.format(n);
    }
}

/** Rövidített érték a diagram-feliratokhoz (nagy összegeknél M/E Ft). */
export function fmtCompact(value: number, format: ReportFormat): string {
    if (format === 'huf') {
        if (Math.abs(value) >= 1_000_000) return `${num.format(value / 1_000_000)} M Ft`;
        if (Math.abs(value) >= 10_000) return `${int.format(Math.round(value / 1000))} E Ft`;
        return `${int.format(Math.round(value))} Ft`;
    }
    return fmtValue(value, format);
}
