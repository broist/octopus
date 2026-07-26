import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { BarChart3, Columns3, Download, FileText, Info } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import { usePageProps } from '@/hooks/usePageProps';
import ReportNav from './Partials/ReportNav';
import ReportChart from './Partials/ReportChart';
import { fmtValue, type ReportData, type ReportDefinition } from './Partials/report';

interface Filters {
    period: string;
    from: string | null;
    to: string | null;
    project: number | null;
    status: string;
    group: string;
}

interface IndexProps extends Record<string, unknown> {
    report: ReportData;
    definition: ReportDefinition;
    tabs: { key: string; label: string; title: string }[];
    filters: Filters;
    periods: Record<string, string>;
    statuses: Record<string, string>;
    projects: { id: number; label: string }[];
}

const SELECT_CLASS =
    'rounded-md border-line bg-white py-1.5 pl-2.5 pr-8 text-sm text-ink focus:border-accent focus:ring-accent/30';

function toneClass(tone?: string | null): string {
    if (tone === 'bad') return 'text-coral';
    if (tone === 'warn') return 'text-amberwarn';
    if (tone === 'good') return 'text-emerald-600';
    return 'text-sidebar';
}

export default function Index() {
    const { report, definition, tabs, filters, periods, statuses, projects } =
        usePageProps<IndexProps>();

    /* --- Látható oszlopok (testre szabható nézet, spec §15) --------------- */
    const storageKey = `octopus.reports.columns.${report.key}.${report.group}`;
    const allKeys = useMemo(() => report.columns.map((c) => c.key), [report.columns]);
    const [visible, setVisible] = useState<string[]>(allKeys);
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        const stored = window.localStorage.getItem(storageKey);
        const parsed: string[] = stored ? JSON.parse(stored) : [];
        const kept = parsed.filter((key) => allKeys.includes(key));
        setVisible(kept.length > 0 ? kept : allKeys);
        setPickerOpen(false);
    }, [storageKey, allKeys]);

    const toggleColumn = (key: string) => {
        const next = visible.includes(key)
            ? visible.filter((k) => k !== key)
            : allKeys.filter((k) => visible.includes(k) || k === key);
        if (next.length === 0) return;
        setVisible(next);
        window.localStorage.setItem(storageKey, JSON.stringify(next));
    };

    const resetColumns = () => {
        setVisible(allKeys);
        window.localStorage.removeItem(storageKey);
    };

    const columns = report.columns.filter((column) => visible.includes(column.key));

    /* --- Szűrők ---------------------------------------------------------- */
    const apply = (patch: Partial<Filters>) => {
        const next = { ...filters, ...patch };
        router.get(
            route('reports.show', report.key),
            {
                period: next.period,
                from: next.period === 'egyedi' ? next.from ?? undefined : undefined,
                to: next.period === 'egyedi' ? next.to ?? undefined : undefined,
                project: next.project ?? undefined,
                status: next.status || undefined,
                group: next.group || undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const exportUrl = (format: 'csv' | 'pdf') => {
        const params = new URLSearchParams({ format, period: filters.period });
        if (filters.period === 'egyedi') {
            if (filters.from) params.set('from', filters.from);
            if (filters.to) params.set('to', filters.to);
        }
        if (filters.project) params.set('project', String(filters.project));
        if (filters.status) params.set('status', filters.status);
        if (filters.group) params.set('group', filters.group);
        params.set('columns', visible.join(','));

        return `${route('reports.export', report.key)}?${params.toString()}`;
    };

    const pickerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!pickerOpen) return;
        const onClick = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [pickerOpen]);

    const hasFilter = (name: string) => definition.filters.includes(name);
    const groupKeys = Object.keys(definition.groups);

    return (
        <>
            <Head title={`${report.title} – Riportok`} />

            <PageHeader
                title="Riportok / Statisztikák"
                subtitle="Elemző kimutatások a többi modul adataiból — szűrhető, testre szabható, exportálható."
                actions={
                    <>
                        <a href={exportUrl('csv')} className="btn-ghost">
                            <Download size={16} />
                            CSV
                        </a>
                        <a href={exportUrl('pdf')} className="btn-ghost">
                            <FileText size={16} />
                            PDF
                        </a>
                    </>
                }
            />

            <ReportNav tabs={tabs} active={report.key} />

            {/* Szűrők */}
            <div className="o-card mb-5 flex flex-wrap items-end gap-3 px-4 py-3">
                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-ink-faint">Időszak</span>
                    <select
                        value={filters.period}
                        onChange={(e) => apply({ period: e.target.value })}
                        className={SELECT_CLASS}
                    >
                        {Object.entries(periods).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>

                {filters.period === 'egyedi' && (
                    <>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-ink-faint">Kezdete</span>
                            <input
                                type="date"
                                value={filters.from ?? ''}
                                onChange={(e) => apply({ from: e.target.value || null })}
                                className={SELECT_CLASS}
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-ink-faint">Vége</span>
                            <input
                                type="date"
                                value={filters.to ?? ''}
                                onChange={(e) => apply({ to: e.target.value || null })}
                                className={SELECT_CLASS}
                            />
                        </label>
                    </>
                )}

                {hasFilter('project') && (
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-ink-faint">Projekt</span>
                        <select
                            value={filters.project ?? ''}
                            onChange={(e) => apply({ project: e.target.value ? Number(e.target.value) : null })}
                            className={SELECT_CLASS}
                        >
                            <option value="">Összes projekt</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {hasFilter('status') && (
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-ink-faint">Státusz</span>
                        <select
                            value={filters.status}
                            onChange={(e) => apply({ status: e.target.value })}
                            className={SELECT_CLASS}
                        >
                            <option value="">Összes státusz</option>
                            {Object.entries(statuses).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {groupKeys.length > 0 && (
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-ink-faint">Bontás</span>
                        <select
                            value={filters.group}
                            onChange={(e) => apply({ group: e.target.value })}
                            className={SELECT_CLASS}
                        >
                            {groupKeys.map((key) => (
                                <option key={key} value={key}>
                                    {definition.groups[key]}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <div className="relative ml-auto" ref={pickerRef}>
                    <button
                        type="button"
                        onClick={() => setPickerOpen((open) => !open)}
                        className="btn-ghost py-1.5"
                    >
                        <Columns3 size={16} />
                        Oszlopok
                        <span className="text-xs text-ink-faint">
                            {visible.length}/{allKeys.length}
                        </span>
                    </button>

                    {pickerOpen && (
                        <div className="absolute right-0 z-20 mt-1 w-64 rounded-card border border-line bg-card p-2 shadow-lg">
                            <div className="max-h-72 overflow-y-auto">
                                {report.columns.map((column) => (
                                    <label
                                        key={column.key}
                                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-cream"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={visible.includes(column.key)}
                                            onChange={() => toggleColumn(column.key)}
                                            className="rounded-sm border-line text-accent focus:ring-accent/30"
                                        />
                                        <span className="text-ink">{column.label}</span>
                                    </label>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={resetColumns}
                                className="mt-1 w-full rounded-sm px-2 py-1.5 text-left text-xs text-ink-soft hover:bg-cream"
                            >
                                Alaphelyzet (minden oszlop)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* A riport fejléce */}
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-sidebar">{report.title}</h2>
                <p className="text-sm text-ink-soft">{report.subtitle}</p>
            </div>

            {/* Összesítő csempék */}
            {report.summary.length > 0 && (
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {report.summary.map((card) => (
                        <div key={card.label} className="o-card px-4 py-3">
                            <div className={clsx('text-xl font-semibold tabular-nums', toneClass(card.tone))}>
                                {fmtValue(card.value, card.format)}
                            </div>
                            <div className="mt-0.5 text-xs text-ink-soft">{card.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {report.chart && <ReportChart chart={report.chart} />}

            {/* Adattábla */}
            {report.rows.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <BarChart3 size={26} />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-sidebar">Nincs megjeleníthető adat</h3>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        A választott időszakra és szűrőkre nincs adat. Módosítsa az időszakot vagy a szűrőket.
                    </p>
                </div>
            ) : (
                <div className="o-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={clsx(
                                            'whitespace-nowrap px-3 py-2.5 font-medium',
                                            column.align === 'right' && 'text-right',
                                        )}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {report.rows.map((row, index) => (
                                <tr
                                    key={index}
                                    onClick={() => row._link && router.get(row._link)}
                                    className={clsx(
                                        'transition',
                                        row._link && 'cursor-pointer hover:bg-cream/50',
                                    )}
                                >
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={clsx(
                                                'px-3 py-2.5',
                                                column.align === 'right' && 'text-right tabular-nums',
                                                column.format === 'text' ? 'text-ink' : 'text-ink',
                                                row._tone === 'bad' && column.align === 'right' && 'text-coral',
                                            )}
                                        >
                                            {fmtValue(row[column.key], column.format)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        {report.totals && (
                            <tfoot>
                                <tr className="border-t border-line bg-cream/60 font-semibold text-sidebar">
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={clsx(
                                                'px-3 py-2.5',
                                                column.align === 'right' && 'text-right tabular-nums',
                                            )}
                                        >
                                            {fmtValue(report.totals?.[column.key], column.format)}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {report.note && (
                <p className="mt-3 flex gap-2 text-xs text-ink-faint">
                    <Info size={14} className="mt-px shrink-0" />
                    <span>{report.note}</span>
                </p>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
