import { useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    CalendarCog,
    HardHat,
    Pencil,
    Plus,
    Trash2,
    Truck,
    Wrench,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import ProgressBar from '@/Components/ProgressBar';
import { fmtDate } from '@/lib/format';
import { endFromStart, nonWorkdayLabel, workdaysBetween } from '@/lib/workday';
import type {
    DepType,
    PhaseDependency,
    PhaseItem,
    PhaseResource,
    ResourceKind,
} from '@/types/models';

const DEP_TYPES: { value: DepType; label: string }[] = [
    { value: 'bk', label: 'BK · Befejezés→Kezdés' },
    { value: 'kk', label: 'KK · Kezdés→Kezdés' },
    { value: 'bb', label: 'BB · Befejezés→Befejezés' },
    { value: 'kb', label: 'KB · Kezdés→Befejezés' },
];

const RESOURCE_KINDS: { value: ResourceKind; label: string }[] = [
    { value: 'kezi', label: 'Kézi erő' },
    { value: 'gepi', label: 'Gépi erő' },
];

interface PhaseFormData {
    name: string;
    starts_on: string;
    due_on: string;
    work_days: number | '';
    progress: number;
    depends_on: PhaseDependency[];
    resources: PhaseResource[];
    [key: string]: string | number | PhaseDependency[] | PhaseResource[];
}

const inputCls =
    'block w-full rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/40';

/** A függőség rövid jelölése, pl. „2BK+1". */
export function depNotation(seq: number, type: DepType, lag: number): string {
    const sign = lag > 0 ? `+${lag}` : lag < 0 ? `${lag}` : '';
    return `${seq}${type.toUpperCase()}${sign}`;
}

function NonWorkdayHint({ value }: { value: string }) {
    const label = nonWorkdayLabel(value);
    if (!label) return null;
    return (
        <p className="mt-1 flex items-center gap-1 text-xs text-amberwarn">
            <AlertTriangle size={12} />
            Figyelem: {label} (nem munkanap)
        </p>
    );
}

function PhaseFields({
    form,
    options,
}: {
    form: ReturnType<typeof useForm<PhaseFormData>>;
    options: PhaseItem[];
}) {
    const d = form.data;

    const setStart = (v: string) => {
        form.setData('starts_on', v);
        if (v && d.due_on) form.setData('work_days', workdaysBetween(v, d.due_on));
        else if (v && d.work_days) form.setData('due_on', endFromStart(v, Number(d.work_days)));
    };
    const setDue = (v: string) => {
        form.setData('due_on', v);
        if (d.starts_on && v) form.setData('work_days', workdaysBetween(d.starts_on, v));
    };
    const setWorkDays = (v: string) => {
        const n = v === '' ? '' : Math.max(1, Number(v));
        form.setData('work_days', n);
        if (d.starts_on && n) form.setData('due_on', endFromStart(d.starts_on, Number(n)));
    };

    const depFor = (id: number) => d.depends_on.find((x) => x.id === id);
    const toggleDep = (id: number) => {
        form.setData(
            'depends_on',
            depFor(id)
                ? d.depends_on.filter((x) => x.id !== id)
                : [...d.depends_on, { id, type: 'bk', lag: 0 }],
        );
    };
    const setDep = (id: number, patch: Partial<PhaseDependency>) => {
        form.setData(
            'depends_on',
            d.depends_on.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        );
    };

    const addResource = () =>
        form.setData('resources', [
            ...d.resources,
            { kind: 'kezi', name: '', quantity: 1, work_days: 1, note: '' },
        ]);
    const setResource = (i: number, patch: Partial<PhaseResource>) =>
        form.setData(
            'resources',
            d.resources.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
        );
    const removeResource = (i: number) =>
        form.setData(
            'resources',
            d.resources.filter((_, idx) => idx !== i),
        );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-2">
                    <InputLabel value="Fázis neve *" />
                    <TextInput
                        value={d.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder="pl. Alapozás"
                    />
                    <InputError message={form.errors.name} />
                </div>
                <div className="sm:col-span-2">
                    <InputLabel value={`Készültség: ${d.progress}%`} />
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={d.progress}
                        onChange={(e) => form.setData('progress', Number(e.target.value))}
                        className="mt-2 w-full accent-[#2E6B4F]"
                    />
                </div>
                <div>
                    <InputLabel value="Kezdés" />
                    <input
                        type="date"
                        value={d.starts_on}
                        onChange={(e) => setStart(e.target.value)}
                        className={inputCls}
                    />
                    <InputError message={form.errors.starts_on} />
                    {d.starts_on && <NonWorkdayHint value={d.starts_on} />}
                </div>
                <div>
                    <InputLabel value="Munkanapok" />
                    <input
                        type="number"
                        min={1}
                        value={d.work_days}
                        onChange={(e) => setWorkDays(e.target.value)}
                        className={inputCls}
                        placeholder="pl. 6"
                    />
                    <InputError message={form.errors.work_days} />
                </div>
                <div>
                    <InputLabel value="Határidő" />
                    <input
                        type="date"
                        value={d.due_on}
                        onChange={(e) => setDue(e.target.value)}
                        className={inputCls}
                    />
                    <InputError message={form.errors.due_on} />
                    {d.due_on && <NonWorkdayHint value={d.due_on} />}
                </div>
            </div>

            {/* Függőségek */}
            <div>
                <InputLabel value="Függőségek (mire vár ez a fázis)" />
                {options.length === 0 ? (
                    <p className="text-xs text-ink-faint">Még nincs másik fázis, amire várhatna.</p>
                ) : (
                    <div className="space-y-1.5">
                        {options.map((o) => {
                            const dep = depFor(o.id);
                            return (
                                <div
                                    key={o.id}
                                    className={clsx(
                                        'flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                                        dep ? 'border-accent/40 bg-accent-50/40' : 'border-line bg-white',
                                    )}
                                >
                                    <label className="flex items-center gap-1.5">
                                        <input
                                            type="checkbox"
                                            checked={!!dep}
                                            onChange={() => toggleDep(o.id)}
                                            className="rounded-sm border-line text-accent focus:ring-accent/40"
                                        />
                                        <span className="font-mono text-xs text-ink-faint">#{o.seq}</span>
                                        <span className="text-ink">{o.name}</span>
                                    </label>
                                    {dep && (
                                        <div className="ml-auto flex items-center gap-2">
                                            <select
                                                value={dep.type}
                                                onChange={(e) =>
                                                    setDep(o.id, { type: e.target.value as DepType })
                                                }
                                                className="rounded-md border-line py-1 text-xs focus:border-accent focus:ring-accent/30"
                                            >
                                                {DEP_TYPES.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-ink-faint">eltolás</span>
                                                <input
                                                    type="number"
                                                    value={dep.lag}
                                                    onChange={(e) =>
                                                        setDep(o.id, { lag: Number(e.target.value) || 0 })
                                                    }
                                                    className="w-16 rounded-md border-line py-1 text-right text-xs focus:border-accent focus:ring-accent/30"
                                                />
                                                <span className="text-xs text-ink-faint">nap</span>
                                            </div>
                                            <span className="rounded bg-sidebar/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-sidebar">
                                                {depNotation(o.seq, dep.type, dep.lag)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <InputError message={form.errors.depends_on as string | undefined} />
            </div>

            {/* Erőforrások */}
            <div>
                <div className="mb-1 flex items-center justify-between">
                    <InputLabel value="Erőforrások" className="mb-0" />
                    <button
                        type="button"
                        onClick={addResource}
                        className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-700"
                    >
                        <Plus size={13} />
                        Erőforrás
                    </button>
                </div>
                {d.resources.length === 0 ? (
                    <p className="text-xs text-ink-faint">
                        Nincs erőforrás. Pl. „3 fő kézi erő, 2 munkanap" vagy „1 gép kezelővel, 1 nap".
                    </p>
                ) : (
                    <div className="space-y-1.5">
                        {d.resources.map((r, i) => (
                            <div
                                key={i}
                                className="grid grid-cols-2 items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 sm:grid-cols-12"
                            >
                                <select
                                    value={r.kind}
                                    onChange={(e) => setResource(i, { kind: e.target.value as ResourceKind })}
                                    className="rounded-md border-line py-1 text-xs focus:border-accent focus:ring-accent/30 sm:col-span-2"
                                >
                                    {RESOURCE_KINDS.map((k) => (
                                        <option key={k.value} value={k.value}>
                                            {k.label}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    value={r.name}
                                    onChange={(e) => setResource(i, { name: e.target.value })}
                                    placeholder="Megnevezés (pl. kőműves)"
                                    className="rounded-md border-line py-1 text-sm focus:border-accent focus:ring-accent/30 sm:col-span-4"
                                />
                                <div className="flex items-center gap-1 sm:col-span-2">
                                    <input
                                        type="number"
                                        min={1}
                                        value={r.quantity}
                                        onChange={(e) => setResource(i, { quantity: Number(e.target.value) || 1 })}
                                        className="w-full rounded-md border-line py-1 text-right text-xs focus:border-accent focus:ring-accent/30"
                                    />
                                    <span className="text-xs text-ink-faint">db/fő</span>
                                </div>
                                <div className="flex items-center gap-1 sm:col-span-2">
                                    <input
                                        type="number"
                                        min={1}
                                        value={r.work_days}
                                        onChange={(e) => setResource(i, { work_days: Number(e.target.value) || 1 })}
                                        className="w-full rounded-md border-line py-1 text-right text-xs focus:border-accent focus:ring-accent/30"
                                    />
                                    <span className="text-xs text-ink-faint">nap</span>
                                </div>
                                <div className="flex items-center gap-1 sm:col-span-2">
                                    <input
                                        value={r.note ?? ''}
                                        onChange={(e) => setResource(i, { note: e.target.value })}
                                        placeholder="megj."
                                        className="w-full rounded-md border-line py-1 text-xs focus:border-accent focus:ring-accent/30"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeResource(i)}
                                        className="shrink-0 rounded p-1 text-ink-faint hover:text-coral"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function toFormDeps(phase: PhaseItem): PhaseDependency[] {
    return phase.dependencies.map((x) => ({ id: x.id, type: x.type, lag: x.lag }));
}

function ResourceChips({ resources }: { resources: PhaseResource[] }) {
    if (resources.length === 0) return null;
    return (
        <div className="mt-1 flex flex-wrap gap-1">
            {resources.map((r, i) => (
                <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded bg-cream px-1.5 py-0.5 text-[11px] text-ink-soft"
                >
                    {r.kind === 'gepi' ? <Truck size={11} /> : <HardHat size={11} />}
                    {r.quantity}× {r.name || (r.kind === 'gepi' ? 'gép' : 'fő')} · {r.work_days} nap
                </span>
            ))}
        </div>
    );
}

function PhaseRow({
    phase,
    allPhases,
    canEdit,
    isFirst,
    isLast,
    conflictWith,
}: {
    phase: PhaseItem;
    allPhases: PhaseItem[];
    canEdit: boolean;
    isFirst: boolean;
    isLast: boolean;
    conflictWith: string[];
}) {
    const [editing, setEditing] = useState(false);

    const form = useForm<PhaseFormData>({
        name: phase.name,
        starts_on: phase.starts_on ?? '',
        due_on: phase.due_on ?? '',
        work_days: phase.work_days ?? '',
        progress: phase.progress,
        depends_on: toFormDeps(phase),
        resources: phase.resources.map((r) => ({ ...r })),
    });

    const save = () => {
        form.put(route('projects.phases.update', phase.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };
    const move = (direction: 'up' | 'down') =>
        router.post(route('projects.phases.move', phase.id), { direction }, { preserveScroll: true });
    const compute = () =>
        router.post(route('projects.phases.compute', phase.id), {}, { preserveScroll: true });
    const remove = () => {
        if (confirm(`Biztosan törli a(z) „${phase.name}” fázist?`)) {
            router.delete(route('projects.phases.destroy', phase.id), { preserveScroll: true });
        }
    };

    const byId = new Map(allPhases.map((p) => [p.id, p]));
    const depLabels = phase.dependencies
        .map((dep) => {
            const pre = byId.get(dep.id);
            return pre ? depNotation(pre.seq, dep.type, dep.lag) : null;
        })
        .filter(Boolean)
        .join(', ');

    if (editing) {
        return (
            <div className="border-t border-line bg-cream/50 px-4 py-4">
                <PhaseFields form={form} options={allPhases.filter((p) => p.id !== phase.id)} />
                <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-primary px-4 py-1.5 text-xs" onClick={save} disabled={form.processing}>
                        Mentés
                    </button>
                    {phase.dependencies.length > 0 && (
                        <button
                            type="button"
                            className="btn-ghost px-3 py-1.5 text-xs"
                            onClick={compute}
                            title="A kezdő- és végdátum kiszámítása a függőségekből"
                        >
                            <CalendarCog size={13} />
                            Dátumok a függőségekből
                        </button>
                    )}
                    <button
                        className="btn-ghost px-4 py-1.5 text-xs"
                        onClick={() => {
                            form.reset();
                            form.clearErrors();
                            setEditing(false);
                        }}
                    >
                        <X size={13} />
                        Mégse
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-start">
            <span className="mt-0.5 hidden w-6 shrink-0 text-right font-mono text-xs text-ink-faint sm:block">
                {phase.seq}.
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                        <span className="mr-1 font-mono text-xs text-ink-faint sm:hidden">{phase.seq}.</span>
                        {phase.name}
                    </span>
                    {phase.is_overdue && <span className="chip chip-coral">Csúszik</span>}
                    {phase.progress === 100 && <span className="chip chip-green">Kész</span>}
                    {conflictWith.length > 0 && (
                        <span
                            className="chip inline-flex items-center gap-1 bg-coral/15 text-coral"
                            title={`Ütközés / párhuzam: ${conflictWith.join(', ')}`}
                        >
                            <AlertTriangle size={11} />
                            Ütközés
                        </span>
                    )}
                </div>
                <div className="mt-0.5 text-xs text-ink-faint">
                    {fmtDate(phase.starts_on)} – {fmtDate(phase.due_on)}
                    {phase.work_days ? <span> · {phase.work_days} munkanap</span> : null}
                    {depLabels && <span> · vár: {depLabels}</span>}
                </div>
                <ResourceChips resources={phase.resources} />
            </div>

            <div className="flex w-full items-center gap-2 sm:w-48">
                <ProgressBar value={phase.progress} warn={phase.is_overdue} className="flex-1" />
                <span className="w-9 text-right text-xs font-medium text-ink-soft">{phase.progress}%</span>
            </div>

            {canEdit && (
                <div className="flex items-center gap-0.5 text-ink-faint">
                    <button onClick={() => move('up')} disabled={isFirst} className="rounded p-1.5 hover:bg-cream hover:text-ink disabled:opacity-30" aria-label="Feljebb">
                        <ArrowUp size={15} />
                    </button>
                    <button onClick={() => move('down')} disabled={isLast} className="rounded p-1.5 hover:bg-cream hover:text-ink disabled:opacity-30" aria-label="Lejjebb">
                        <ArrowDown size={15} />
                    </button>
                    <button onClick={() => setEditing(true)} className="rounded p-1.5 hover:bg-cream hover:text-ink" aria-label="Szerkesztés">
                        <Pencil size={15} />
                    </button>
                    <button onClick={remove} className="rounded p-1.5 hover:bg-coral/10 hover:text-coral" aria-label="Törlés">
                        <Trash2 size={15} />
                    </button>
                </div>
            )}
        </div>
    );
}

/** Ütközés-számítás: mely elődökkel fut párhuzamosan (átfedő időszak). */
export function conflictsFor(phase: PhaseItem, byId: Map<number, PhaseItem>): string[] {
    if (!phase.starts_on || !phase.due_on) return [];
    const out: string[] = [];
    for (const dep of phase.dependencies) {
        const pre = byId.get(dep.id);
        if (!pre || !pre.starts_on || !pre.due_on) continue;
        // BK: az utódnak az előd befejezése UTÁN kellene kezdődnie.
        if (dep.type === 'bk' && phase.starts_on <= pre.due_on) {
            out.push(`#${pre.seq} ${pre.name}`);
        }
    }
    return out;
}

export default function PhasesPanel({
    projectId,
    phases,
    canEdit,
}: {
    projectId: number;
    phases: PhaseItem[];
    canEdit: boolean;
}) {
    const [adding, setAdding] = useState(false);

    const addForm = useForm<PhaseFormData>({
        name: '',
        starts_on: '',
        due_on: '',
        work_days: '',
        progress: 0,
        depends_on: [],
        resources: [],
    });

    const submitAdd = () => {
        addForm.post(route('projects.phases.store', projectId), {
            preserveScroll: true,
            onSuccess: () => {
                addForm.reset();
                setAdding(false);
            },
        });
    };

    const byId = new Map(phases.map((p) => [p.id, p]));

    return (
        <section className="o-card">
            <header className="flex items-center justify-between px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                    Fázisok / mérföldkövek
                </h2>
                {canEdit && !adding && (
                    <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setAdding(true)}>
                        <Plus size={14} />
                        Új fázis
                    </button>
                )}
            </header>

            {adding && (
                <div className="border-t border-line bg-cream/50 px-4 py-4">
                    <PhaseFields form={addForm} options={phases} />
                    <div className="mt-4 flex gap-2">
                        <button className="btn-primary px-4 py-1.5 text-xs" onClick={submitAdd} disabled={addForm.processing}>
                            Fázis hozzáadása
                        </button>
                        <button
                            className="btn-ghost px-4 py-1.5 text-xs"
                            onClick={() => {
                                addForm.reset();
                                addForm.clearErrors();
                                setAdding(false);
                            }}
                        >
                            <X size={13} />
                            Mégse
                        </button>
                    </div>
                </div>
            )}

            {phases.length === 0 && !adding ? (
                <div className="border-t border-line px-4 py-8 text-center text-sm text-ink-faint">
                    Még nincsenek fázisok. {canEdit && 'Adja hozzá az elsőt az „Új fázis" gombbal.'}
                </div>
            ) : (
                phases.map((phase, i) => (
                    <PhaseRow
                        key={phase.id}
                        phase={phase}
                        allPhases={phases}
                        canEdit={canEdit}
                        isFirst={i === 0}
                        isLast={i === phases.length - 1}
                        conflictWith={conflictsFor(phase, byId)}
                    />
                ))
            )}

            {/* Jelmagyarázat a szerkesztéshez */}
            {canEdit && phases.length > 0 && (
                <div className="border-t border-line px-4 py-2.5 text-xs text-ink-faint">
                    <Wrench size={12} className="mr-1 inline" />
                    Tipp: a munkanapok mezőbe a kezdéssel együtt beírt szám automatikusan kiszámolja a
                    határidőt (hétvégék és ünnepek kihagyva). A függőségeknél a jelölés pl. „2BK+1" = a
                    2. fázis befejezése után 1 munkanappal indul.
                </div>
            )}
        </section>
    );
}
