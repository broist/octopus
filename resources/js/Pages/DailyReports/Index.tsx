import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarDays,
    ClipboardList,
    HardHat,
    Image as ImageIcon,
    Plus,
    User as UserIcon,
    Users,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import { WeatherChip } from '@/Pages/DailyReports/Partials/Weather';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { DailyReportListItem, DailyReportProjectOption, Paginator } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    reports: Paginator<DailyReportListItem>;
    filters: { project: number | null; from: string | null; to: string | null; mine: boolean };
    stats: { today: number; week: number; projects_today: number; total: number };
    projects: DailyReportProjectOption[];
    canCreate: boolean;
}

const selectClass =
    'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

function paginationLabel(label: string): string {
    return label
        .replace('&laquo;', '«')
        .replace('&raquo;', '»')
        .replace('Previous', 'Előző')
        .replace('Next', 'Következő');
}

export default function Index() {
    const { reports, filters, stats, projects, canCreate } = usePageProps<IndexProps>();

    const [project, setProject] = useState(filters.project ? String(filters.project) : '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [mine, setMine] = useState(filters.mine);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('daily-reports.index'),
                {
                    project: project || undefined,
                    from: from || undefined,
                    to: to || undefined,
                    mine: mine || undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [project, from, to, mine]);

    return (
        <>
            <Head title="Napi jelentés / Munkanapló" />

            <PageHeader
                title="Napi jelentés / Munkanapló"
                subtitle="Helyszíni építési napló: elvégzett munka, létszám, akadályok, fotók és automatikus időjárás – projektenként, naponta."
                actions={
                    canCreate && (
                        <Link href={route('daily-reports.create')} className="btn-primary">
                            <Plus size={16} />
                            Új jelentés
                        </Link>
                    )
                }
            />

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Mai jelentések" value={stats.today} icon={CalendarDays} />
                <StatCard label="E heti jelentések" value={stats.week} icon={ClipboardList} />
                <StatCard label="Ma naplózott projektek" value={stats.projects_today} icon={HardHat} />
                <StatCard label="Összes bejegyzés" value={stats.total} icon={ClipboardList} />
            </div>

            {/* Szűrők */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <select value={project} onChange={(e) => setProject(e.target.value)} className={`${selectClass} sm:w-64`}>
                    <option value="">Minden projekt</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.code} – {p.name}
                        </option>
                    ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="whitespace-nowrap">Dátumtól</span>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass} />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="whitespace-nowrap">-ig</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectClass} />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                        type="checkbox"
                        checked={mine}
                        onChange={(e) => setMine(e.target.checked)}
                        className="rounded-sm border-line text-accent focus:ring-accent/40"
                    />
                    Csak az enyéim
                </label>
            </div>

            {reports.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <ClipboardList size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs a szűrésnek megfelelő jelentés</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.project || filters.from || filters.to || filters.mine
                            ? 'Módosítsa a szűrőket.'
                            : 'Rögzítse az első napi jelentést a helyszínről – pár koppintással, akár telefonról.'}
                    </p>
                    {canCreate && (
                        <Link href={route('daily-reports.create')} className="btn-primary mt-5">
                            <Plus size={16} />
                            Új jelentés
                        </Link>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {reports.data.map((r) => (
                        <Link
                            key={r.id}
                            href={route('daily-reports.show', r.id)}
                            className="block px-4 py-3 transition hover:bg-cream/40"
                        >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-sidebar/5 text-sidebar">
                                        <CalendarDays size={16} />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-ink">{fmtDate(r.report_date)}</span>
                                            {r.project && (
                                                <span className="font-mono text-xs text-accent">{r.project.code}</span>
                                            )}
                                            {r.weather && <WeatherChip weather={r.weather} />}
                                            {r.has_obstacles && (
                                                <span className="inline-flex items-center gap-1 text-xs text-coral">
                                                    <AlertTriangle size={12} />
                                                    akadály
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{r.work_done}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pl-13 text-xs text-ink-faint sm:pl-0">
                                    <span className="inline-flex items-center gap-1" title="Összlétszám">
                                        <Users size={13} />
                                        {r.total_headcount}
                                    </span>
                                    {r.photos_count > 0 && (
                                        <span className="inline-flex items-center gap-1" title="Fotók">
                                            <ImageIcon size={13} />
                                            {r.photos_count}
                                        </span>
                                    )}
                                    <span className="hidden items-center gap-1 sm:inline-flex" title="Készítette">
                                        <UserIcon size={13} />
                                        {r.creator_name ?? '–'}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {reports.data.length > 0 && reports.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {reports.links.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                preserveState
                                className={clsx(
                                    'rounded-md px-3 py-1.5 text-sm',
                                    link.active ? 'bg-accent font-medium text-white' : 'text-ink-soft hover:bg-white',
                                )}
                            >
                                {paginationLabel(link.label)}
                            </Link>
                        ) : (
                            <span key={i} className="px-3 py-1.5 text-sm text-ink-faint">
                                {paginationLabel(link.label)}
                            </span>
                        ),
                    )}
                </div>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
