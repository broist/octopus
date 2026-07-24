import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    CalendarDays,
    CheckSquare,
    ChevronLeft,
    ChevronRight,
    Diamond,
    Flag,
    Package,
    PalmtreeIcon,
    Plus,
    TriangleAlert,
    Truck,
    User as UserIcon,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import EventModal from '@/Pages/Scheduling/Partials/EventModal';
import { usePageProps } from '@/hooks/usePageProps';
import type {
    AbsenceCalItem,
    CalendarEventItem,
    DeliveryCalItem,
    MachineBookingCalItem,
    MilestoneItem,
    Option,
    ProjectRef,
    TaskDueItem,
} from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    view: 'month' | 'week' | 'day';
    date: string;
    range: { start: string; end: string };
    events: CalendarEventItem[];
    milestones: MilestoneItem[];
    taskItems: TaskDueItem[];
    absences: AbsenceCalItem[];
    machineBookings: MachineBookingCalItem[];
    deliveries: DeliveryCalItem[];
    projects: ProjectRef[];
    users: Option[];
    types: Record<string, string>;
    filters: { person: number | null; type: string };
    canCreate: boolean;
}

/* ---------------- dátum-segédek (időzóna-biztos, YYYY-MM-DD) ---------------- */

const toDate = (s: string) => new Date(`${s}T00:00:00`);
const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s: string, n: number) => {
    const d = toDate(s);
    d.setDate(d.getDate() + n);
    return toStr(d);
};
const addMonths = (s: string, n: number) => {
    const d = toDate(s);
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    return toStr(d);
};

const monthTitleFmt = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long' });
const dayTitleFmt = new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
});
const weekdayFmt = new Intl.DateTimeFormat('hu-HU', { weekday: 'short' });

/* ---------------- projekt-színek ---------------- */

const PALETTE = ['#2E6B4F', '#C98A2B', '#5B7DB1', '#9C6ADE', '#C0503A', '#3D8F8A', '#B0568C', '#7A8B3F'];
const colorFor = (project: ProjectRef | null, personal = false) =>
    personal ? '#8a8a7e' : project ? PALETTE[project.id % PALETTE.length] : '#2E6B4F';

/* ---------------- réteg-állapot (localStorage) ---------------- */

interface Layers {
    personal: boolean;
    deadlines: boolean;
    tasks: boolean;
    absences: boolean;
    machines: boolean;
    deliveries: boolean;
    offProjects: number[];
}

const defaultLayers: Layers = {
    personal: true,
    deadlines: true,
    tasks: true,
    absences: true,
    machines: true,
    deliveries: true,
    offProjects: [],
};

function loadLayers(): Layers {
    try {
        return { ...defaultLayers, ...JSON.parse(localStorage.getItem('octopus.cal.layers') ?? '{}') };
    } catch {
        return defaultLayers;
    }
}

/* ==================================================================== */

export default function Index() {
    const {
        view, date, range, events, milestones, taskItems, absences, machineBookings, deliveries,
        projects, users, types, filters, canCreate,
    } = usePageProps<IndexProps>();

    const [layers, setLayers] = useState<Layers>(loadLayers);
    useEffect(() => localStorage.setItem('octopus.cal.layers', JSON.stringify(layers)), [layers]);

    const [modal, setModal] = useState<{ event: CalendarEventItem | null; presetDate: string } | null>(null);

    /* -------- navigáció -------- */

    const visit = (params: Record<string, unknown>) =>
        router.get(route('scheduling.index'), {
            view,
            date,
            person: filters.person ?? undefined,
            type: filters.type || undefined,
            ...params,
        }, { preserveState: true, preserveScroll: true });

    const nav = (dir: -1 | 0 | 1) => {
        const newDate = dir === 0
            ? toStr(new Date())
            : view === 'month' ? addMonths(date, dir)
            : view === 'week' ? addDays(date, dir * 7)
            : addDays(date, dir);
        visit({ date: newDate });
    };

    /* -------- réteg-szűrés -------- */

    const projOff = (p: ProjectRef | null) => p !== null && layers.offProjects.includes(p.id);

    const visibleEvents = useMemo(
        () => events.filter((e) =>
            e.type === 'szemelyes' ? layers.personal : !projOff(e.project)),
        [events, layers],
    );
    const visibleMilestones = useMemo(
        () => (layers.deadlines ? milestones.filter((m) => !projOff(m.project)) : []),
        [milestones, layers],
    );
    const visibleTasks = useMemo(
        () => (layers.tasks ? taskItems.filter((t) => !projOff(t.project)) : []),
        [taskItems, layers],
    );
    const visibleAbsences = useMemo(
        () => (layers.absences ? absences : []),
        [absences, layers],
    );
    const visibleMachineBookings = useMemo(
        () => (layers.machines ? machineBookings.filter((b) => !projOff(b.project)) : []),
        [machineBookings, layers],
    );
    const visibleDeliveries = useMemo(
        () => (layers.deliveries ? deliveries.filter((d) => !projOff(d.project)) : []),
        [deliveries, layers],
    );

    const itemsFor = (day: string) => ({
        events: visibleEvents.filter((e) => e.starts_on <= day && day <= e.ends_on),
        milestones: visibleMilestones.filter((m) => m.date === day),
        tasks: visibleTasks.filter((t) => t.date === day),
        absences: visibleAbsences.filter((a) => a.starts_on <= day && day <= a.ends_on),
        machineBookings: visibleMachineBookings.filter((b) => b.starts_on <= day && day <= b.ends_on),
        deliveries: visibleDeliveries.filter((d) => d.date === day),
    });

    /* -------- napok listája a tartományban -------- */

    const days = useMemo(() => {
        const list: string[] = [];
        let d = range.start;
        let guard = 0;
        while (d <= range.end && guard++ < 60) {
            list.push(d);
            d = addDays(d, 1);
        }
        return list;
    }, [range]);

    const today = toStr(new Date());
    const currentMonth = date.slice(0, 7);

    /* -------- chip-ek -------- */

    const EventChip = ({ e, detailed = false }: { e: CalendarEventItem; detailed?: boolean }) => (
        <button
            onClick={() => setModal({ event: e, presetDate: e.starts_on })}
            className={clsx(
                'flex w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 text-white transition hover:opacity-85',
                detailed && 'py-1 text-xs',
            )}
            style={{ backgroundColor: colorFor(e.project, e.type === 'szemelyes') }}
            title={`${e.title}${e.project ? ` · ${e.project.code}` : ''}`}
        >
            {e.is_conflicted && <TriangleAlert size={11} className="shrink-0 text-white" />}
            {e.type === 'szemelyes' && <UserIcon size={10} className="shrink-0" />}
            <span className="truncate">
                {e.start_time && <span className="opacity-80">{e.start_time} </span>}
                {e.title}
            </span>
        </button>
    );

    const MilestoneChip = ({ m, detailed = false }: { m: MilestoneItem; detailed?: boolean }) => (
        <button
            onClick={() => m.project && router.get(route('projects.show', m.project.id))}
            className={clsx(
                'flex w-full items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 transition hover:bg-cream',
                detailed && 'py-1 text-xs',
                m.done ? 'border-line text-ink-faint line-through' : 'border-amberwarn/50 text-[#8a5e17]',
            )}
            title={`${m.project?.code ?? ''} ${m.label}`}
        >
            {m.kind === 'atadas' ? <Flag size={10} className="shrink-0" /> : <Diamond size={10} className="shrink-0" />}
            <span className="truncate">
                {m.project && <span className="font-mono">{m.project.code}</span>} {m.label}
            </span>
        </button>
    );

    const TaskChip = ({ t, detailed = false }: { t: TaskDueItem; detailed?: boolean }) => (
        <button
            onClick={() => router.get(route('tasks.index'))}
            className={clsx(
                'flex w-full items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 transition hover:bg-cream',
                detailed && 'py-1 text-xs',
                t.done
                    ? 'border-line text-ink-faint line-through'
                    : t.overdue
                      ? 'border-coral/60 text-coral'
                      : 'border-accent/40 text-accent-700',
            )}
            title={t.label}
        >
            <CheckSquare size={10} className="shrink-0" />
            <span className="truncate">{t.label}</span>
        </button>
    );

    const AbsenceChip = ({ a, detailed = false }: { a: AbsenceCalItem; detailed?: boolean }) => (
        <div
            className={clsx(
                'flex w-full items-center gap-1 truncate rounded-sm border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 text-amber-700',
                detailed && 'py-1 text-xs',
            )}
            title={`${a.user_name ?? ''} — ${a.type_label}`}
        >
            <PalmtreeIcon size={10} className="shrink-0" />
            <span className="truncate">
                {a.user_name} · {a.type_label}
            </span>
        </div>
    );

    const MachineBookingChip = ({ b, detailed = false }: { b: MachineBookingCalItem; detailed?: boolean }) => (
        <button
            onClick={() => router.get(route('machines.show', b.machine_id))}
            className={clsx(
                'flex w-full items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 transition hover:bg-cream',
                detailed && 'py-1 text-xs',
                b.is_conflicted
                    ? 'border-coral/60 bg-coral/10 text-coral'
                    : 'border-slate-300 bg-slate-50 text-slate-600',
            )}
            title={`${b.machine_name ?? 'Gép'}${b.project ? ` · ${b.project.code}` : ''}`}
        >
            {b.is_conflicted ? (
                <TriangleAlert size={10} className="shrink-0" />
            ) : (
                <Truck size={10} className="shrink-0" />
            )}
            <span className="truncate">
                {b.machine_name}
                {b.project && <span className="ml-1 font-mono opacity-80">{b.project.code}</span>}
            </span>
        </button>
    );

    const DeliveryChip = ({ d, detailed = false }: { d: DeliveryCalItem; detailed?: boolean }) => (
        <button
            onClick={() => router.get(route('materials.index', d.project ? { project: d.project.id } : {}))}
            className={clsx(
                'flex w-full items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 transition hover:bg-cream',
                detailed && 'py-1 text-xs',
                d.received
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-sky-300 bg-sky-50 text-sky-700',
            )}
            title={`${d.material_name ?? 'Anyag'}${d.project ? ` · ${d.project.code}` : ''} — ${d.received ? 'beérkezett' : 'várható'}`}
        >
            <Package size={10} className="shrink-0" />
            <span className="truncate">
                {d.material_name}
                {d.project && <span className="ml-1 font-mono opacity-80">{d.project.code}</span>}
            </span>
        </button>
    );

    const DayItems = ({ day, limit }: { day: string; limit: number }) => {
        const { events: evs, milestones: ms, tasks: ts, absences: abs, machineBookings: mbs, deliveries: dls } = itemsFor(day);
        const all: ReactNode[] = [
            ...abs.map((a) => <AbsenceChip key={a.key} a={a} />),
            ...mbs.map((b) => <MachineBookingChip key={b.key} b={b} />),
            ...dls.map((d) => <DeliveryChip key={d.key} d={d} />),
            ...ms.map((m) => <MilestoneChip key={m.key} m={m} />),
            ...ts.map((t) => <TaskChip key={t.key} t={t} />),
            ...evs.map((e) => <EventChip key={e.id} e={e} />),
        ];
        const extra = all.length - limit;
        return (
            <div className="space-y-0.5">
                {all.slice(0, limit)}
                {extra > 0 && (
                    <button
                        onClick={() => visit({ view: 'day', date: day })}
                        className="w-full rounded-sm px-1.5 text-left text-[11px] font-medium text-ink-faint hover:text-ink"
                    >
                        +{extra} további
                    </button>
                )}
            </div>
        );
    };

    /* ==================================================================== */

    const title =
        view === 'month' ? monthTitleFmt.format(toDate(date))
        : view === 'week' ? `${monthTitleFmt.format(toDate(range.start))} — ${range.start.slice(8)}–${range.end.slice(8)}.`
        : dayTitleFmt.format(toDate(date));

    return (
        <>
            <Head title="Ütemezés / Naptár" />

            <PageHeader
                title="Ütemezés / Naptár"
                subtitle="Ki hol dolgozik, szállítások, határidők — projektenkénti rétegekkel."
                actions={
                    <button
                        className="btn-primary"
                        onClick={() => setModal({ event: null, presetDate: date })}
                    >
                        <Plus size={16} />
                        Új bejegyzés
                    </button>
                }
            />

            {/* Vezérlősor */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                    <button className="btn-ghost px-2.5 py-1.5" onClick={() => nav(-1)} aria-label="Előző">
                        <ChevronLeft size={16} />
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => nav(0)}>
                        Ma
                    </button>
                    <button className="btn-ghost px-2.5 py-1.5" onClick={() => nav(1)} aria-label="Következő">
                        <ChevronRight size={16} />
                    </button>
                </div>

                <h2 className="min-w-44 text-base font-semibold capitalize text-sidebar">{title}</h2>

                <div className="flex rounded-md border border-line bg-white p-0.5">
                    {(['month', 'week', 'day'] as const).map((v) => (
                        <button
                            key={v}
                            onClick={() => visit({ view: v })}
                            className={clsx(
                                'rounded px-3 py-1.5 text-xs font-medium',
                                view === v ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink',
                            )}
                        >
                            {v === 'month' ? 'Hónap' : v === 'week' ? 'Hét' : 'Nap'}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                        value={filters.person ?? ''}
                        onChange={(e) => visit({ person: e.target.value || undefined })}
                        className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                    >
                        <option value="">Mindenki</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.type}
                        onChange={(e) => visit({ type: e.target.value || undefined })}
                        className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                    >
                        <option value="">Minden típus</option>
                        {Object.entries(types).map(([v, l]) => (
                            <option key={v} value={v}>
                                {l}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
                {/* Réteg-választó */}
                <aside className="o-card h-fit shrink-0 p-4 lg:w-60">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        Rétegek
                    </h3>
                    <div className="space-y-1.5 text-sm">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={layers.personal}
                                onChange={(e) => setLayers({ ...layers, personal: e.target.checked })}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#8a8a7e' }} />
                            Saját naptár
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={layers.deadlines}
                                onChange={(e) => setLayers({ ...layers, deadlines: e.target.checked })}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            <Diamond size={11} className="text-amberwarn" />
                            Mérföldkövek / határidők
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={layers.tasks}
                                onChange={(e) => setLayers({ ...layers, tasks: e.target.checked })}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            <CheckSquare size={11} className="text-accent" />
                            Feladatok
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={layers.absences}
                                onChange={(e) => setLayers({ ...layers, absences: e.target.checked })}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            <PalmtreeIcon size={11} className="text-amber-600" />
                            Szabadság / távollét
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={layers.machines}
                                onChange={(e) => setLayers({ ...layers, machines: e.target.checked })}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            <Truck size={11} className="text-slate-500" />
                            Gépfoglalások
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={layers.deliveries}
                                onChange={(e) => setLayers({ ...layers, deliveries: e.target.checked })}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            <Package size={11} className="text-sky-600" />
                            Anyagszállítások
                        </label>
                    </div>

                    {projects.length > 0 && (
                        <>
                            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                Projektek
                            </h3>
                            <div className="space-y-1.5 text-sm">
                                {projects.map((p) => {
                                    const on = !layers.offProjects.includes(p.id);
                                    return (
                                        <label key={p.id} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={() =>
                                                    setLayers({
                                                        ...layers,
                                                        offProjects: on
                                                            ? [...layers.offProjects, p.id]
                                                            : layers.offProjects.filter((id) => id !== p.id),
                                                    })
                                                }
                                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                                            />
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                                style={{ background: colorFor(p) }}
                                            />
                                            <span className="truncate" title={p.name}>
                                                <span className="font-mono text-xs">{p.code}</span> {p.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </aside>

                {/* Naptár-törzs */}
                <div className="min-w-0 flex-1">
                    {view === 'month' && (
                        <div className="o-card overflow-hidden">
                            <div className="grid grid-cols-7 border-b border-line bg-cream/60 text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                {days.slice(0, 7).map((d) => (
                                    <div key={d} className="py-1.5">
                                        {weekdayFmt.format(toDate(d))}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {days.map((day) => {
                                    const inMonth = day.slice(0, 7) === currentMonth;
                                    return (
                                        <div
                                            key={day}
                                            className={clsx(
                                                'group min-h-24 border-b border-r border-line/60 p-1',
                                                !inMonth && 'bg-cream/50',
                                            )}
                                        >
                                            <div className="mb-0.5 flex items-center justify-between px-0.5">
                                                <button
                                                    onClick={() => visit({ view: 'day', date: day })}
                                                    className={clsx(
                                                        'flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium hover:bg-cream',
                                                        day === today
                                                            ? 'bg-accent text-white hover:bg-accent'
                                                            : inMonth
                                                              ? 'text-ink'
                                                              : 'text-ink-faint',
                                                    )}
                                                >
                                                    {Number(day.slice(8))}
                                                </button>
                                                <button
                                                    onClick={() => setModal({ event: null, presetDate: day })}
                                                    className="rounded p-0.5 text-ink-faint opacity-0 hover:bg-cream hover:text-accent group-hover:opacity-100"
                                                    aria-label="Új bejegyzés erre a napra"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            <DayItems day={day} limit={3} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {view === 'week' && (
                        <div className="o-card overflow-hidden">
                            <div className="grid grid-cols-1 sm:grid-cols-7">
                                {days.map((day) => (
                                    <div
                                        key={day}
                                        className="group min-h-40 border-b border-r border-line/60 p-1.5"
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <button
                                                onClick={() => visit({ view: 'day', date: day })}
                                                className={clsx(
                                                    'rounded px-1.5 py-0.5 text-xs font-semibold hover:bg-cream',
                                                    day === today ? 'bg-accent text-white hover:bg-accent' : 'text-ink',
                                                )}
                                            >
                                                {weekdayFmt.format(toDate(day))} {Number(day.slice(8))}.
                                            </button>
                                            <button
                                                onClick={() => setModal({ event: null, presetDate: day })}
                                                className="rounded p-0.5 text-ink-faint opacity-0 hover:bg-cream hover:text-accent group-hover:opacity-100"
                                                aria-label="Új bejegyzés"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                        <DayItems day={day} limit={8} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {view === 'day' && (() => {
                        const { events: evs, milestones: ms, tasks: ts, absences: abs, machineBookings: mbs, deliveries: dls } = itemsFor(date);
                        const empty = evs.length + ms.length + ts.length + abs.length + mbs.length + dls.length === 0;
                        return (
                            <div className="space-y-4">
                                {empty && (
                                    <div className="o-card flex flex-col items-center px-6 py-14 text-center">
                                        <CalendarDays size={32} className="text-ink-faint" />
                                        <p className="mt-3 text-sm text-ink-soft">Erre a napra nincs bejegyzés.</p>
                                        <button
                                            className="btn-primary mt-4"
                                            onClick={() => setModal({ event: null, presetDate: date })}
                                        >
                                            <Plus size={15} />
                                            Új bejegyzés
                                        </button>
                                    </div>
                                )}

                                {abs.length > 0 && (
                                    <section className="o-card p-4">
                                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                            Szabadság / távollét
                                        </h3>
                                        <div className="space-y-1">
                                            {abs.map((a) => <AbsenceChip key={a.key} a={a} detailed />)}
                                        </div>
                                    </section>
                                )}

                                {mbs.length > 0 && (
                                    <section className="o-card p-4">
                                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                            Gépfoglalások
                                        </h3>
                                        <div className="space-y-1">
                                            {mbs.map((b) => <MachineBookingChip key={b.key} b={b} detailed />)}
                                        </div>
                                    </section>
                                )}

                                {dls.length > 0 && (
                                    <section className="o-card p-4">
                                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                            Anyagszállítások / beérkezések
                                        </h3>
                                        <div className="space-y-1">
                                            {dls.map((d) => <DeliveryChip key={d.key} d={d} detailed />)}
                                        </div>
                                    </section>
                                )}

                                {ms.length > 0 && (
                                    <section className="o-card p-4">
                                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                            Mérföldkövek / határidők
                                        </h3>
                                        <div className="space-y-1">
                                            {ms.map((m) => <MilestoneChip key={m.key} m={m} detailed />)}
                                        </div>
                                    </section>
                                )}

                                {ts.length > 0 && (
                                    <section className="o-card p-4">
                                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                            Határidős feladatok
                                        </h3>
                                        <div className="space-y-1">
                                            {ts.map((t) => <TaskChip key={t.key} t={t} detailed />)}
                                        </div>
                                    </section>
                                )}

                                {evs.length > 0 && (
                                    <section className="o-card divide-y divide-line">
                                        {evs.map((e) => (
                                            <button
                                                key={e.id}
                                                onClick={() => setModal({ event: e, presetDate: e.starts_on })}
                                                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-cream/60"
                                            >
                                                <span
                                                    className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                                                    style={{ backgroundColor: colorFor(e.project, e.type === 'szemelyes') }}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-medium text-ink">{e.title}</span>
                                                        {e.is_conflicted && (
                                                            <span className="chip chip-coral">
                                                                <TriangleAlert size={11} />
                                                                Ütközés
                                                            </span>
                                                        )}
                                                        <span className="chip chip-grey">{types[e.type]}</span>
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-ink-faint">
                                                        {e.start_time
                                                            ? `${e.start_time}${e.end_time ? `–${e.end_time}` : ''}`
                                                            : 'Egész nap'}
                                                        {e.starts_on !== e.ends_on && ` · ${e.starts_on} → ${e.ends_on}`}
                                                        {e.project && ` · ${e.project.code} ${e.project.name}`}
                                                        {e.location && ` · ${e.location}`}
                                                        {e.assignees.length > 0 &&
                                                            ` · ${e.assignees.map((a) => a.name).join(', ')}`}
                                                    </span>
                                                </span>
                                            </button>
                                        ))}
                                    </section>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {modal && (
                <EventModal
                    event={modal.event}
                    presetDate={modal.presetDate}
                    users={users}
                    projects={projects}
                    types={types}
                    canCreate={canCreate}
                    onClose={() => setModal(null)}
                />
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
