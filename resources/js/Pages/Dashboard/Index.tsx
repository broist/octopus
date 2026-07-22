import { ReactNode } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    CalendarClock,
    Diamond,
    FolderKanban,
    ListChecks,
    TriangleAlert,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import StatusChip, { SlippingChip } from '@/Components/StatusChip';
import ProgressBar from '@/Components/ProgressBar';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { ProjectStatus } from '@/types/models';

interface DashboardProps extends Record<string, unknown> {
    stats: {
        active_projects: number;
        deadlines_14d: number;
        open_tasks: number;
        alerts: number;
    };
    projects: {
        id: number;
        code: string;
        name: string;
        status: ProjectStatus;
        client_name: string | null;
        progress: number;
        is_slipping: boolean;
    }[];
    deadlines: {
        key: string;
        kind: 'fazis' | 'feladat';
        date: string;
        label: string;
        project: { id: number; code: string } | null;
    }[];
    alerts: { key: string; text: string; project_id: number | null; url?: string | null }[];
    todayEvents: {
        id: number;
        title: string;
        type: string;
        start_time: string | null;
        project_code: string | null;
        people: string;
    }[];
    myTasks: { id: number; title: string; overdue: boolean }[];
    activities: {
        id: number;
        description: string;
        project: { id: number; code: string } | null;
        user_name: string | null;
        created_at: string;
    }[];
}

function Panel({
    title,
    action,
    children,
}: {
    title: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="o-card p-5">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    );
}

const EmptyNote = ({ children }: { children: ReactNode }) => (
    <p className="rounded-md border border-dashed border-line bg-cream/60 px-4 py-6 text-center text-sm text-ink-faint">
        {children}
    </p>
);

export default function Dashboard() {
    const { auth, stats, projects, deadlines, alerts, todayEvents, myTasks, activities } =
        usePageProps<DashboardProps>();
    const firstName = auth.user?.name?.split(' ')[0] ?? '';

    return (
        <>
            <Head title="Vezérlőpult" />

            <PageHeader
                title={`Üdv, ${firstName}!`}
                subtitle="Áttekintés a folyamatban lévő munkákról és a napi teendőkről."
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Aktív projektek" value={stats.active_projects} icon={FolderKanban} />
                <StatCard
                    label="Határidő 14 napon belül"
                    value={stats.deadlines_14d}
                    icon={CalendarClock}
                    tone="amber"
                />
                <StatCard label="Nyitott feladatok" value={stats.open_tasks} icon={ListChecks} tone="green" />
                <StatCard
                    label="Riasztások"
                    value={stats.alerts}
                    icon={TriangleAlert}
                    tone={stats.alerts > 0 ? 'coral' : 'default'}
                />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    {/* Aktív projektek */}
                    <Panel
                        title="Aktív projektek"
                        action={
                            <Link
                                href={route('projects.index')}
                                className="text-xs font-medium text-accent hover:text-accent-700"
                            >
                                Összes projekt
                            </Link>
                        }
                    >
                        {projects.length === 0 ? (
                            <EmptyNote>
                                Nincs futó projekt. Az első munkát a Projektek menüben veheti fel.
                            </EmptyNote>
                        ) : (
                            <div className="space-y-2">
                                {projects.map((p) => (
                                    <Link
                                        key={p.id}
                                        href={route('projects.show', p.id)}
                                        className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5 transition hover:border-accent/40 hover:bg-cream/50"
                                    >
                                        <span className="font-mono text-xs text-ink-faint">{p.code}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-ink">
                                                {p.name}
                                            </span>
                                            {p.client_name && (
                                                <span className="block truncate text-xs text-ink-faint">
                                                    {p.client_name}
                                                </span>
                                            )}
                                        </span>
                                        {p.is_slipping && <SlippingChip />}
                                        <StatusChip status={p.status} />
                                        <span className="hidden w-28 items-center gap-2 sm:flex">
                                            <ProgressBar
                                                value={p.progress}
                                                warn={p.is_slipping}
                                                className="flex-1"
                                            />
                                            <span className="w-8 text-right text-xs text-ink-soft">
                                                {p.progress}%
                                            </span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </Panel>

                    {/* Mai nap */}
                    <Panel
                        title="Mai nap"
                        action={
                            <Link
                                href={route('scheduling.index')}
                                className="text-xs font-medium text-accent hover:text-accent-700"
                            >
                                Naptár
                            </Link>
                        }
                    >
                        {todayEvents.length === 0 && myTasks.length === 0 ? (
                            <EmptyNote>
                                Mára nincs beosztás vagy határidős teendő. Az Ütemezés / Naptár
                                menüben vehet fel bejegyzést.
                            </EmptyNote>
                        ) : (
                            <div className="space-y-1.5">
                                {todayEvents.map((e) => (
                                    <div key={e.id} className="flex items-center gap-2 text-sm">
                                        <span className="w-12 shrink-0 font-mono text-xs text-ink-faint">
                                            {e.start_time ?? '—'}
                                        </span>
                                        <span className="truncate font-medium text-ink">{e.title}</span>
                                        {e.project_code && (
                                            <span className="shrink-0 font-mono text-xs text-ink-faint">
                                                {e.project_code}
                                            </span>
                                        )}
                                        {e.people && (
                                            <span className="hidden truncate text-xs text-ink-faint sm:block">
                                                · {e.people}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {myTasks.map((t) => (
                                    <Link
                                        key={t.id}
                                        href={route('tasks.index', { mine: 1 })}
                                        className="flex items-center gap-2 text-sm hover:text-accent-700"
                                    >
                                        <ListChecks size={14} className="w-12 shrink-0 text-ink-faint" />
                                        <span
                                            className={clsx(
                                                'truncate',
                                                t.overdue ? 'font-medium text-coral' : 'text-ink',
                                            )}
                                        >
                                            {t.title}
                                            {t.overdue && ' (lejárt!)'}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </Panel>

                    {/* Legutóbbi tevékenység */}
                    <Panel title="Legutóbbi tevékenység">
                        {activities.length === 0 ? (
                            <EmptyNote>
                                Itt jelennek majd meg a friss események: naplóbejegyzések,
                                feltöltések, státuszváltások.
                            </EmptyNote>
                        ) : (
                            <ol className="space-y-2.5">
                                {activities.map((a) => (
                                    <li key={a.id} className="flex gap-2.5 text-sm">
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                        <div className="min-w-0">
                                            <p className="text-ink">
                                                {a.project && (
                                                    <Link
                                                        href={route('projects.show', a.project.id)}
                                                        className="mr-1 font-mono text-xs text-accent hover:text-accent-700"
                                                    >
                                                        {a.project.code}
                                                    </Link>
                                                )}
                                                {a.description}
                                            </p>
                                            <p className="text-xs text-ink-faint">
                                                {a.user_name ? `${a.user_name} · ` : ''}
                                                {fmtDateTime(a.created_at)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Panel>
                </div>

                <div className="space-y-4">
                    {/* Riasztások */}
                    <Panel title="Riasztások">
                        {alerts.length === 0 ? (
                            <EmptyNote>Nincs riasztás — minden ütemben halad. 👌</EmptyNote>
                        ) : (
                            <div className="space-y-1.5">
                                {alerts.map((a) => (
                                    <Link
                                        key={a.key}
                                        href={
                                            a.url ??
                                            (a.project_id
                                                ? route('projects.show', a.project_id)
                                                : route('tasks.index'))
                                        }
                                        className="flex items-start gap-2 rounded-md bg-coral/10 px-3 py-2 text-sm text-[#9c3d2b] transition hover:bg-coral/15"
                                    >
                                        <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                                        {a.text}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </Panel>

                    {/* Közelgő határidők */}
                    <Panel
                        title="Közelgő határidők"
                        action={
                            <Link
                                href={route('scheduling.index')}
                                className="text-xs font-medium text-accent hover:text-accent-700"
                            >
                                Naptár
                            </Link>
                        }
                    >
                        {deadlines.length === 0 ? (
                            <EmptyNote>A következő 14 napban nincs határidő.</EmptyNote>
                        ) : (
                            <div className="space-y-1.5">
                                {deadlines.map((d) => (
                                    <div key={d.key} className="flex items-center gap-2 text-sm">
                                        {d.kind === 'fazis' ? (
                                            <Diamond size={13} className="shrink-0 text-amberwarn" />
                                        ) : (
                                            <ListChecks size={13} className="shrink-0 text-accent" />
                                        )}
                                        <span className="w-20 shrink-0 text-xs text-ink-faint">
                                            {fmtDate(d.date)}
                                        </span>
                                        <span className="truncate text-ink">{d.label}</span>
                                        {d.project && (
                                            <span className="ml-auto shrink-0 font-mono text-xs text-ink-faint">
                                                {d.project.code}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>

                    {/* Pénzügyi pillanatkép — a 9. modullal érkezik */}
                    <Panel title="Pénzügyi pillanatkép">
                        <EmptyNote>
                            Kintlévőségek és költségtúllépések — a Pénzügy / Költségvetés (9.)
                            modul elkészültével jelenik meg.
                        </EmptyNote>
                    </Panel>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
