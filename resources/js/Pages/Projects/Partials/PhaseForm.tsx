import { useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { AlertTriangle, Plus, Search, X } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { endFromStart, nonWorkdayLabel, workdaysBetween } from '@/lib/workday';
import {
    DEP_TYPES,
    RESOURCE_KINDS,
    depNotation,
    normalize,
    phaseMatches,
    phaseRef,
} from '@/lib/phases';
import type {
    DepType,
    PhaseDependency,
    PhaseItem,
    PhaseResource,
    ResourceKind,
} from '@/types/models';

export interface PhaseFormData {
    name: string;
    parent_id: number | '';
    starts_on: string;
    due_on: string;
    work_days: number | '';
    progress: number;
    depends_on: PhaseDependency[];
    resources: PhaseResource[];
    [key: string]: string | number | PhaseDependency[] | PhaseResource[];
}

export type PhaseForm = ReturnType<typeof useForm<PhaseFormData>>;

export const inputCls =
    'block w-full rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/40';

export function emptyPhaseForm(parentId: number | '' = ''): PhaseFormData {
    return {
        name: '',
        parent_id: parentId,
        starts_on: '',
        due_on: '',
        work_days: '',
        progress: 0,
        depends_on: [],
        resources: [],
    };
}

export function toFormData(phase: PhaseItem): PhaseFormData {
    return {
        name: phase.name,
        parent_id: phase.parent_id ?? '',
        starts_on: phase.starts_on ?? '',
        due_on: phase.due_on ?? '',
        work_days: phase.work_days ?? '',
        progress: phase.progress,
        depends_on: phase.dependencies.map((x) => ({ id: x.id, type: x.type, lag: x.lag })),
        resources: phase.resources.map((r) => ({ ...r })),
    };
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

/**
 * Függőség-választó. Egy sablonból betöltött ütemterv több száz soros, ezért
 * itt nem listázunk mindent: a kiválasztottak látszanak, újat kereséssel lehet
 * hozzáadni. Csoportsorra nem lehet hivatkozni — azoknak nincs saját dátumuk.
 */
function DependencyPicker({ form, options }: { form: PhaseForm; options: PhaseItem[] }) {
    const [query, setQuery] = useState('');

    const chosen = form.data.depends_on;
    const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

    const results = useMemo(() => {
        const needle = normalize(query.trim());
        if (needle === '') return [];

        return options
            .filter((o) => !o.is_group && !chosen.some((c) => c.id === o.id) && phaseMatches(o, needle))
            .slice(0, 10);
    }, [options, chosen, query]);

    const add = (id: number) => {
        form.setData('depends_on', [...chosen, { id, type: 'bk', lag: 0 }]);
        setQuery('');
    };
    const remove = (id: number) =>
        form.setData('depends_on', chosen.filter((x) => x.id !== id));
    const patch = (id: number, change: Partial<PhaseDependency>) =>
        form.setData(
            'depends_on',
            chosen.map((x) => (x.id === id ? { ...x, ...change } : x)),
        );

    return (
        <div>
            <InputLabel value="Függőségek (mire vár ez a fázis)" />

            {chosen.length > 0 && (
                <div className="mb-2 space-y-1.5">
                    {chosen.map((dep) => {
                        const pre = byId.get(dep.id);
                        if (!pre) return null;

                        return (
                            <div
                                key={dep.id}
                                className="flex flex-wrap items-center gap-2 rounded-md border border-accent/40 bg-accent-50/40 px-2.5 py-1.5 text-sm"
                            >
                                <span className="font-mono text-xs text-ink-faint">
                                    {phaseRef(pre)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-ink">{pre.name}</span>

                                <select
                                    value={dep.type}
                                    onChange={(e) => patch(dep.id, { type: e.target.value as DepType })}
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
                                        onChange={(e) => patch(dep.id, { lag: Number(e.target.value) || 0 })}
                                        className="w-16 rounded-md border-line py-1 text-right text-xs focus:border-accent focus:ring-accent/30"
                                    />
                                    <span className="text-xs text-ink-faint">nap</span>
                                </div>

                                <span className="rounded bg-sidebar/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-sidebar">
                                    {depNotation(phaseRef(pre), dep.type, dep.lag)}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => remove(dep.id)}
                                    className="rounded p-1 text-ink-faint hover:text-coral"
                                    aria-label="Függőség eltávolítása"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-faint" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Előd fázis keresése név vagy sorszám szerint…"
                    className={`${inputCls} pl-8`}
                />
            </div>

            {query.trim() !== '' && (
                <div className="mt-1 overflow-hidden rounded-md border border-line bg-white">
                    {results.length === 0 ? (
                        <p className="px-2.5 py-2 text-xs text-ink-faint">Nincs találat.</p>
                    ) : (
                        results.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => add(o.id)}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-cream"
                            >
                                <Plus size={13} className="shrink-0 text-accent" />
                                <span className="font-mono text-xs text-ink-faint">{phaseRef(o)}</span>
                                <span className="min-w-0 flex-1 truncate text-ink">{o.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}

            <InputError message={form.errors.depends_on as string | undefined} />
        </div>
    );
}

function ResourceRows({ form }: { form: PhaseForm }) {
    const d = form.data;

    const add = () =>
        form.setData('resources', [
            ...d.resources,
            { kind: 'kezi', name: '', quantity: 1, work_days: 1, note: '' },
        ]);
    const patch = (i: number, change: Partial<PhaseResource>) =>
        form.setData(
            'resources',
            d.resources.map((r, idx) => (idx === i ? { ...r, ...change } : r)),
        );
    const remove = (i: number) =>
        form.setData('resources', d.resources.filter((_, idx) => idx !== i));

    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                <InputLabel value="Erőforrások" className="mb-0" />
                <button
                    type="button"
                    onClick={add}
                    className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-700"
                >
                    <Plus size={13} />
                    Erőforrás
                </button>
            </div>

            {d.resources.length === 0 ? (
                <p className="text-xs text-ink-faint">
                    Nincs erőforrás. Pl. „3 fő kézi erő, 2 munkanap” vagy „1 gép kezelővel, 1 nap”.
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
                                onChange={(e) => patch(i, { kind: e.target.value as ResourceKind })}
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
                                onChange={(e) => patch(i, { name: e.target.value })}
                                placeholder="Megnevezés (pl. kőműves)"
                                className="rounded-md border-line py-1 text-sm focus:border-accent focus:ring-accent/30 sm:col-span-4"
                            />
                            <div className="flex items-center gap-1 sm:col-span-2">
                                <input
                                    type="number"
                                    min={1}
                                    value={r.quantity}
                                    onChange={(e) => patch(i, { quantity: Number(e.target.value) || 1 })}
                                    className="w-full rounded-md border-line py-1 text-right text-xs focus:border-accent focus:ring-accent/30"
                                />
                                <span className="text-xs text-ink-faint">db/fő</span>
                            </div>
                            <div className="flex items-center gap-1 sm:col-span-2">
                                <input
                                    type="number"
                                    min={1}
                                    value={r.work_days}
                                    onChange={(e) => patch(i, { work_days: Number(e.target.value) || 1 })}
                                    className="w-full rounded-md border-line py-1 text-right text-xs focus:border-accent focus:ring-accent/30"
                                />
                                <span className="text-xs text-ink-faint">nap</span>
                            </div>
                            <div className="flex items-center gap-1 sm:col-span-2">
                                <input
                                    value={r.note ?? ''}
                                    onChange={(e) => patch(i, { note: e.target.value })}
                                    placeholder="megj."
                                    className="w-full rounded-md border-line py-1 text-xs focus:border-accent focus:ring-accent/30"
                                />
                                <button
                                    type="button"
                                    onClick={() => remove(i)}
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
    );
}

/**
 * A fázis szerkesztő mezői.
 *
 * Összegző (csoport) soron csak a megnevezés írható: a dátumok és a készültség
 * a gyerekekből gördülnek fel, ezért ott nincs értelme őket kézzel megadni.
 */
export default function PhaseFields({
    form,
    options,
    groups,
    isGroup = false,
    showParent = false,
}: {
    form: PhaseForm;
    /** A lehetséges elődök (a szerkesztett fázis nélkül). */
    options: PhaseItem[];
    /** A választható szülő csoportok — csak felvitelkor. */
    groups: PhaseItem[];
    isGroup?: boolean;
    showParent?: boolean;
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

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className={isGroup && !showParent ? 'lg:col-span-4' : 'lg:col-span-2'}>
                    <InputLabel value="Fázis neve *" />
                    <TextInput
                        value={d.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder="pl. Alapozás"
                    />
                    <InputError message={form.errors.name} />
                </div>

                {showParent && (
                    <div className="sm:col-span-2">
                        <InputLabel value="Hova kerüljön" />
                        <select
                            value={d.parent_id}
                            onChange={(e) =>
                                form.setData('parent_id', e.target.value ? Number(e.target.value) : '')
                            }
                            className={inputCls}
                        >
                            <option value="">– Önálló, felső szintű fázis –</option>
                            {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {'\u00a0\u00a0\u00a0'.repeat(g.level)}
                                    {phaseRef(g)} {g.name}
                                </option>
                            ))}
                        </select>
                        <InputError message={form.errors.parent_id as string | undefined} />
                    </div>
                )}

                {!isGroup && (
                    <>
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
                    </>
                )}
            </div>

            {isGroup ? (
                <p className="rounded-md border border-line bg-cream/60 px-3 py-2 text-xs text-ink-soft">
                    Ez egy összegző sor: a dátuma és a készültsége az alá tartozó fázisokból gördül
                    fel, ezért itt csak a megnevezése módosítható.
                </p>
            ) : (
                <>
                    <DependencyPicker form={form} options={options} />
                    <ResourceRows form={form} />
                </>
            )}
        </div>
    );
}
