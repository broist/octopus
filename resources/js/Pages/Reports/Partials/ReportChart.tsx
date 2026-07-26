import clsx from 'clsx';
import { fmtCompact, type ReportChartData } from './report';

const SERIES_COLORS = ['bg-accent', 'bg-sidebar-active', 'bg-amberwarn'];

/**
 * Vízszintes sávdiagram — külső könyvtár nélkül, a hosszú magyar feliratokhoz
 * igazítva. Negatív értékeknél (pl. veszteség) középvonalról indul a sáv.
 */
export default function ReportChart({ chart }: { chart: ReportChartData }) {
    const all = chart.series.flatMap((s) => s.values);
    const max = Math.max(...all.map((v) => Math.abs(v)), 0);
    const hasNegative = all.some((v) => v < 0);

    if (max === 0) return null;

    return (
        <div className="o-card mb-5 px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-sidebar">{chart.title}</h2>
                {chart.series.length > 1 && (
                    <div className="flex items-center gap-3">
                        {chart.series.map((series, i) => (
                            <span key={series.label} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                                <span className={clsx('h-2.5 w-2.5 rounded-sm', SERIES_COLORS[i % SERIES_COLORS.length])} />
                                {series.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                {chart.labels.map((label, rowIndex) => (
                    <div key={`${label}-${rowIndex}`} className="flex items-center gap-3">
                        <div className="w-24 shrink-0 truncate text-xs text-ink-soft sm:w-36" title={label}>
                            {label}
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                            {chart.series.map((series, seriesIndex) => {
                                const value = series.values[rowIndex] ?? 0;
                                const width = (Math.abs(value) / max) * (hasNegative ? 50 : 100);
                                const negative = value < 0;

                                return (
                                    <div
                                        key={series.label}
                                        className="relative h-4 flex-1 rounded-sm bg-cream"
                                        title={`${series.label}: ${fmtCompact(value, series.format)}`}
                                    >
                                        {hasNegative && (
                                            <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                                        )}
                                        <span
                                            className={clsx(
                                                'absolute inset-y-0 rounded-sm transition-all',
                                                negative ? 'bg-coral' : SERIES_COLORS[seriesIndex % SERIES_COLORS.length],
                                            )}
                                            style={
                                                hasNegative
                                                    ? negative
                                                        ? { right: '50%', width: `${width}%` }
                                                        : { left: '50%', width: `${width}%` }
                                                    : { left: 0, width: `${width}%` }
                                            }
                                        />
                                        <span
                                            className="absolute inset-y-0 right-1 flex items-center text-[10px] tabular-nums text-ink-faint"
                                        >
                                            {fmtCompact(value, series.format)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
