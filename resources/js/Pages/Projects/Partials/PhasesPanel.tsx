import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    CalendarCog,
    ChevronDown,
    ChevronRight,
    Diamond,
    FolderTree,
    HardHat,
    ListPlus,
    Pencil,
    Plus,
    Search,
    Trash2,
    Truck,
    Wrench,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import ProgressBar from '@/Components/ProgressBar';
import { fmtDate } from '@/lib/format';
import { conflictsFor, depNotation, matchingIds, normalize, phaseRef, selectionSize } from '@/lib/phases';
import PhaseFields, {
    emptyPhaseForm,
    toFormData,
    type PhaseFormData,
} from '@/Pages/Projects/Partials/PhaseForm';
import type { PhaseItem, PhaseResource, PhaseTemplateInfo } from '@/types/models';

/** Mennyivel tolódik beljebb egy szint a fában. */
const INDENT = 16;

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

/**
 * Egy fázis szerkesztő űrlapja. Csak a szerkesztett sorra épül fel — egy
 * sablonból betöltött ütemterv több száz soros, ott soronkénti űrlapállapot
 * feleslegesen terhelné a felületet.
 */
function PhaseEditor({
    phase,
    options,
    onClose,
}: {
    phase: PhaseItem;
    options: PhaseItem[];
    onClose: () => void;
}) {
    const form = useForm<PhaseFormData>(toFormData(phase));

    const save = () =>
        form.put(route('projects.phases.update', phase.id), {
            preserveScroll: true,
            onSuccess: onClose,
        });

    const compute = () =>
        router.post(route('projects.phases.compute', phase.id), {}, { preserveScroll: true });

    return (
        <div className="border-t border-line bg-cream/50 px-4 py-4">
            <PhaseFields form={form} options={options} groups={[]} isGroup={phase.is_group} />
            <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary px-4 py-1.5 text-xs" onClick={save} disabled={form.processing}>
                    Mentés
                </button>
                {!phase.is_group && phase.dependencies.length > 0 && (
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
                        onClose();
                    }}
                >
                    <X size={13} />
                    Mégse
                </button>
            </div>
        </div>
    );
}

function PhaseRow({
    phase,
    depLabels,
    conflictWith,
    canEdit,
    hasChildren,
    isOpen,
    isSelected,
    canMoveUp,
    canMoveDown,
    subtreeSize,
    onToggleOpen,
    onToggleSelect,
    onEdit,
}: {
    phase: PhaseItem;
    depLabels: string;
    conflictWith: string[];
    canEdit: boolean;
    hasChildren: boolean;
    isOpen: boolean;
    isSelected: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    subtreeSize: number;
    onToggleOpen: () => void;
    onToggleSelect: () => void;
    onEdit: () => void;
}) {
    const move = (direction: 'up' | 'down') =>
        router.post(route('projects.phases.move', phase.id), { direction }, { preserveScroll: true });

    const remove = () => {
        const question = phase.is_group && subtreeSize > 1
            ? `Biztosan törli a(z) „${phase.name}” csoportot? A teljes ága törlődik — ${subtreeSize} sor.`
            : `Biztosan törli a(z) „${phase.name}” fázist?`;

        if (confirm(question)) {
            router.delete(route('projects.phases.destroy', phase.id), { preserveScroll: true });
        }
    };

    const hasDates = phase.starts_on !== null || phase.due_on !== null;

    return (
        <div
            className={clsx(
                'flex flex-col gap-2 border-t border-line py-2 pr-3 sm:flex-row sm:items-center',
                phase.is_group ? 'bg-cream/40' : 'bg-white',
                isSelected && 'bg-coral/5',
            )}
        >
            <div
                className="flex min-w-0 flex-1 items-start gap-1.5"
                style={{ paddingLeft: 10 + phase.level * INDENT }}
            >
                {canEdit && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggleSelect}
                        className="mt-1 shrink-0 rounded-sm border-line text-coral focus:ring-coral/40"
                        aria-label={`${phase.name} kijelölése`}
                    />
                )}

                {hasChildren ? (
                    <button
                        type="button"
                        onClick={onToggleOpen}
                        className="mt-0.5 shrink-0 rounded p-0.5 text-ink-faint hover:bg-line/60 hover:text-ink"
                        aria-label={isOpen ? 'Becsukás' : 'Kinyitás'}
                    >
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <span className="mt-0.5 w-[22px] shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                            {phaseRef(phase)}
                        </span>
                        <span
                            className={clsx(
                                'min-w-0 text-sm',
                                phase.is_group ? 'font-semibold text-sidebar' : 'text-ink',
                            )}
                        >
                            {phase.name}
                        </span>
                        {phase.is_milestone && (
                            <span className="chip chip-grey shrink-0">
                                <Diamond size={10} />
                                Mérföldkő
                            </span>
                        )}
                        {phase.is_group && (
                            <span className="shrink-0 text-[11px] text-ink-faint">
                                {phase.leaf_count} munkasor
                            </span>
                        )}
                        {phase.is_overdue && <span className="chip chip-coral shrink-0">Csúszik</span>}
                        {!phase.is_group && phase.progress === 100 && (
                            <span className="chip chip-green shrink-0">Kész</span>
                        )}
                        {conflictWith.length > 0 && (
                            <span
                                className="chip inline-flex shrink-0 items-center gap-1 bg-coral/15 text-coral"
                                title={`Ütközés / párhuzam: ${conflictWith.join(', ')}`}
                            >
                                <AlertTriangle size={11} />
                                Ütközés
                            </span>
                        )}
                    </div>

                    {(hasDates || depLabels) && (
                        <div className="mt-0.5 text-xs text-ink-faint">
                            {hasDates && `${fmtDate(phase.starts_on)} – ${fmtDate(phase.due_on)}`}
                            {phase.work_days ? <span> · {phase.work_days} munkanap</span> : null}
                            {depLabels && <span> · vár: {depLabels}</span>}
                        </div>
                    )}

                    <ResourceChips resources={phase.resources} />
                </div>
            </div>

            <div className="flex w-full shrink-0 items-center gap-2 sm:w-40">
                <ProgressBar value={phase.progress} warn={phase.is_overdue} className="flex-1" />
                <span className="w-9 text-right text-xs font-medium text-ink-soft">
                    {phase.progress}%
                </span>
            </div>

            {canEdit && (
                <div className="flex shrink-0 items-center gap-0.5 text-ink-faint">
                    <button
                        onClick={() => move('up')}
                        disabled={!canMoveUp}
                        className="rounded p-1 hover:bg-cream hover:text-ink disabled:opacity-30"
                        aria-label="Feljebb"
                    >
                        <ArrowUp size={14} />
                    </button>
                    <button
                        onClick={() => move('down')}
                        disabled={!canMoveDown}
                        className="rounded p-1 hover:bg-cream hover:text-ink disabled:opacity-30"
                        aria-label="Lejjebb"
                    >
                        <ArrowDown size={14} />
                    </button>
                    <button
                        onClick={onEdit}
                        className="rounded p-1 hover:bg-cream hover:text-ink"
                        aria-label="Szerkesztés"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        onClick={remove}
                        className="rounded p-1 hover:bg-coral/10 hover:text-coral"
                        aria-label="Törlés"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

/** Ütemterv-sablon betöltése: kész munkastruktúra, amiből utána törölhetünk. */
function TemplateLoader({
    projectId,
    templates,
    hasPhases,
    onDone,
}: {
    projectId: number;
    templates: PhaseTemplateInfo[];
    hasPhases: boolean;
    onDone: () => void;
}) {
    const [key, setKey] = useState(templates.find((t) => t.is_default)?.key ?? templates[0]?.key ?? '');
    const [replace, setReplace] = useState(false);
    const [busy, setBusy] = useState(false);

    const chosen = templates.find((t) => t.key === key);

    const load = () => {
        if (replace && !confirm('A jelenlegi ütemterv minden sora törlődik, és a sablon lép a helyébe. Folytatja?')) {
            return;
        }

        setBusy(true);
        router.post(
            route('projects.phases.template', projectId),
            { template: key, replace },
            { preserveScroll: true, onFinish: () => setBusy(false), onSuccess: onDone },
        );
    };

    if (templates.length === 0) {
        return (
            <p className="text-sm text-ink-faint">
                Nincs elérhető ütemterv-sablon.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="block w-full rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/40 sm:max-w-sm"
                >
                    {templates.map((t) => (
                        <option key={t.key} value={t.key}>
                            {t.name} ({t.row_count} sor)
                        </option>
                    ))}
                </select>
                <button className="btn-primary shrink-0 px-4 py-1.5 text-xs" onClick={load} disabled={busy || !key}>
                    <FolderTree size={14} />
                    Sablon betöltése
                </button>
            </div>

            {chosen && (
                <div className="text-xs leading-relaxed text-ink-soft">
                    <p>{chosen.description}</p>
                    <p className="mt-1 text-ink-faint">
                        {chosen.row_count} sor, ebből {chosen.group_count} összegző csoport. Fő
                        egységek: {chosen.preview.slice(0, 8).join(' · ')}
                        {chosen.preview.length > 8 && ' …'}
                    </p>
                </div>
            )}

            {hasPhases && (
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                    <input
                        type="checkbox"
                        checked={replace}
                        onChange={(e) => setReplace(e.target.checked)}
                        className="rounded-sm border-line text-coral focus:ring-coral/40"
                    />
                    A meglévő ütemterv cseréje (a mostani sorok törlődnek) — enélkül a sablon a
                    lista végére kerül.
                </label>
            )}
        </div>
    );
}

export default function PhasesPanel({
    projectId,
    phases,
    canEdit,
    templates,
}: {
    projectId: number;
    phases: PhaseItem[];
    canEdit: boolean;
    templates: PhaseTemplateInfo[];
}) {
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const addForm = useForm<PhaseFormData>(emptyPhaseForm());

    // Az újonnan megjelenő felső szintű csoportok egyszer automatikusan
    // kinyílnak (pl. sablon betöltése után), a mélyebb szintek csukva maradnak
    // — így egy 400+ soros ütemterv is áttekinthető marad.
    const seen = useRef<Set<number>>(new Set());
    useEffect(() => {
        const fresh = phases.filter((p) => p.is_group && p.level === 0 && !seen.current.has(p.id));
        phases.forEach((p) => seen.current.add(p.id));

        if (fresh.length > 0) {
            setExpanded((prev) => new Set([...prev, ...fresh.map((p) => p.id)]));
        }
    }, [phases]);

    const byId = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);
    const groups = useMemo(() => phases.filter((p) => p.is_group), [phases]);
    const workRows = phases.length - groups.length;

    /** Az ág mérete soronként (a sor + minden leszármazottja). */
    const subtreeSize = useMemo(() => {
        const size = new Map<number, number>();
        for (let i = 0; i < phases.length; i++) {
            let j = i + 1;
            while (j < phases.length && phases[j].level > phases[i].level) j++;
            size.set(phases[i].id, j - i);
        }
        return size;
    }, [phases]);

    const needle = normalize(query.trim());
    const matches = useMemo(
        () => (needle === '' ? null : matchingIds(phases, needle)),
        [phases, needle],
    );

    /** A ténylegesen kirajzolt sorok: a becsukott ágak kimaradnak. */
    const rows = useMemo(() => {
        const out: PhaseItem[] = [];
        let hiddenBelow: number | null = null;

        for (const phase of phases) {
            if (hiddenBelow !== null && phase.level > hiddenBelow) continue;
            hiddenBelow = null;

            if (matches && !matches.has(phase.id)) continue;

            out.push(phase);

            // Keresés közben mindent nyitva mutatunk, hogy a találat látszódjon.
            if (!matches && phase.is_group && !expanded.has(phase.id)) {
                hiddenBelow = phase.level;
            }
        }

        return out;
    }, [phases, expanded, matches]);

    const selectedCount = useMemo(() => selectionSize(phases, selected), [phases, selected]);

    const toggle = (set: Set<number>, id: number) => {
        const next = new Set(set);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        return next;
    };

    const toggleOpen = (id: number) => setExpanded((prev) => toggle(prev, id));
    const toggleSelect = (id: number) => setSelected((prev) => toggle(prev, id));

    const openGroupCount = groups.filter((g) => expanded.has(g.id)).length;

    const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
    const toggleAllVisible = () =>
        setSelected((prev) => {
            const next = new Set(prev);
            for (const row of rows) {
                if (allVisibleSelected) {
                    next.delete(row.id);
                } else {
                    next.add(row.id);
                }
            }
            return next;
        });

    const deleteSelected = () => {
        if (
            !confirm(
                `Biztosan törli a kijelölt sorokat? A csoportok teljes águkkal együtt törlődnek — összesen ${selectedCount} sor.`,
            )
        ) {
            return;
        }

        router.delete(route('projects.phases.destroy-many', projectId), {
            data: { ids: [...selected] },
            preserveScroll: true,
            onSuccess: () => setSelected(new Set()),
        });
    };

    const submitAdd = () =>
        addForm.post(route('projects.phases.store', projectId), {
            preserveScroll: true,
            onSuccess: () => {
                addForm.reset();
                setAdding(false);
            },
        });

    const depLabelsFor = (phase: PhaseItem) =>
        phase.dependencies
            .map((dep) => {
                const pre = byId.get(dep.id);
                return pre ? depNotation(phaseRef(pre), dep.type, dep.lag) : null;
            })
            .filter(Boolean)
            .join(', ');

    /** Mozgatható-e: csak a testvérei között, a fa szerkezetének megtartásával. */
    const siblingBounds = useMemo(() => {
        const bounds = new Map<number, { first: boolean; last: boolean }>();
        const byParent = new Map<number | null, PhaseItem[]>();

        for (const phase of phases) {
            const list = byParent.get(phase.parent_id) ?? [];
            list.push(phase);
            byParent.set(phase.parent_id, list);
        }
        for (const list of byParent.values()) {
            list.forEach((p, i) =>
                bounds.set(p.id, { first: i === 0, last: i === list.length - 1 }),
            );
        }

        return bounds;
    }, [phases]);

    return (
        <section className="o-card">
            <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                        Ütemterv / munkastruktúra
                    </h2>
                    {phases.length > 0 && (
                        <p className="mt-0.5 text-xs text-ink-faint">
                            {phases.length} sor · {workRows} munkasor · {groups.length} csoport
                        </p>
                    )}
                </div>

                {canEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                        {groups.length > 0 && (
                            <button
                                className="btn-ghost px-3 py-1.5 text-xs"
                                onClick={() =>
                                    setExpanded(
                                        openGroupCount === groups.length
                                            ? new Set()
                                            : new Set(groups.map((g) => g.id)),
                                    )
                                }
                            >
                                {openGroupCount === groups.length ? 'Mind becsuk' : 'Mind kinyit'}
                            </button>
                        )}
                        {phases.length > 0 && (
                            <button
                                className="btn-ghost px-3 py-1.5 text-xs"
                                onClick={() => setTemplateOpen((v) => !v)}
                            >
                                <FolderTree size={14} />
                                Sablon
                            </button>
                        )}
                        {!adding && (
                            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setAdding(true)}>
                                <Plus size={14} />
                                Új fázis
                            </button>
                        )}
                    </div>
                )}
            </header>

            {canEdit && templateOpen && phases.length > 0 && (
                <div className="border-t border-line bg-cream/50 px-4 py-4">
                    <TemplateLoader
                        projectId={projectId}
                        templates={templates}
                        hasPhases
                        onDone={() => setTemplateOpen(false)}
                    />
                </div>
            )}

            {adding && (
                <div className="border-t border-line bg-cream/50 px-4 py-4">
                    <PhaseFields form={addForm} options={phases} groups={groups} showParent />
                    <div className="mt-4 flex gap-2">
                        <button
                            className="btn-primary px-4 py-1.5 text-xs"
                            onClick={submitAdd}
                            disabled={addForm.processing}
                        >
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

            {phases.length > 12 && (
                <div className="relative border-t border-line px-4 py-2">
                    <Search size={14} className="pointer-events-none absolute left-6 top-4 text-ink-faint" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Keresés a fázisok között (név vagy sorszám)…"
                        className="block w-full rounded-md border-line bg-white py-1.5 pl-8 text-sm focus:border-accent focus:ring-accent/40"
                    />
                    {query !== '' && (
                        <button
                            onClick={() => setQuery('')}
                            className="absolute right-6 top-3.5 rounded p-0.5 text-ink-faint hover:text-ink"
                            aria-label="Keresés törlése"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            )}

            {canEdit && selectedCount > 0 && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line bg-coral/10 px-4 py-2.5">
                    <span className="text-sm font-medium text-ink">
                        {selectedCount} sor kijelölve
                    </span>
                    <button
                        onClick={deleteSelected}
                        className="btn inline-flex border border-coral/40 bg-white px-3 py-1.5 text-xs text-coral hover:bg-coral/10"
                    >
                        <Trash2 size={13} />
                        Kijelöltek törlése
                    </button>
                    <button
                        onClick={() => setSelected(new Set())}
                        className="text-xs font-medium text-ink-soft hover:text-ink"
                    >
                        Kijelölés megszüntetése
                    </button>
                </div>
            )}

            {phases.length === 0 ? (
                <div className="border-t border-line px-4 py-8">
                    <div className="mx-auto max-w-xl text-center">
                        <ListPlus size={28} className="mx-auto text-ink-faint" />
                        <h3 className="mt-2 text-sm font-semibold text-sidebar">
                            Még nincs ütemterv
                        </h3>
                        <p className="mt-1 text-sm text-ink-soft">
                            {canEdit
                                ? 'Töltsön be egy kész munkastruktúrát, és törölje belőle a nem szükséges sorokat — vagy vegye fel a fázisokat egyesével az „Új fázis” gombbal.'
                                : 'Ehhez a projekthez még nincsenek fázisok.'}
                        </p>
                    </div>

                    {canEdit && (
                        <div className="mx-auto mt-5 max-w-xl rounded-card border border-line bg-cream/50 p-4">
                            <TemplateLoader
                                projectId={projectId}
                                templates={templates}
                                hasPhases={false}
                                onDone={() => setTemplateOpen(false)}
                            />
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {canEdit && (
                        <div
                            className="flex items-center gap-2 border-t border-line bg-cream/60 py-1.5 pr-3"
                            style={{ paddingLeft: 10 }}
                        >
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleAllVisible}
                                className="shrink-0 rounded-sm border-line text-coral focus:ring-coral/40"
                                aria-label="Látható sorok kijelölése"
                            />
                            <span className="text-[11px] uppercase tracking-wide text-ink-faint">
                                {matches
                                    ? `${rows.length} találat`
                                    : 'A látható sorok kijelölése'}
                            </span>
                        </div>
                    )}

                    {rows.length === 0 ? (
                        <div className="border-t border-line px-4 py-8 text-center text-sm text-ink-faint">
                            Nincs a keresésre illeszkedő fázis.
                        </div>
                    ) : (
                        rows.map((phase) => {
                            const bounds = siblingBounds.get(phase.id);

                            return editingId === phase.id ? (
                                <PhaseEditor
                                    key={phase.id}
                                    phase={phase}
                                    options={phases.filter((p) => p.id !== phase.id)}
                                    onClose={() => setEditingId(null)}
                                />
                            ) : (
                                <PhaseRow
                                    key={phase.id}
                                    phase={phase}
                                    depLabels={depLabelsFor(phase)}
                                    conflictWith={conflictsFor(phase, byId)}
                                    canEdit={canEdit}
                                    hasChildren={(subtreeSize.get(phase.id) ?? 1) > 1}
                                    isOpen={expanded.has(phase.id)}
                                    isSelected={selected.has(phase.id)}
                                    canMoveUp={!(bounds?.first ?? true)}
                                    canMoveDown={!(bounds?.last ?? true)}
                                    subtreeSize={subtreeSize.get(phase.id) ?? 1}
                                    onToggleOpen={() => toggleOpen(phase.id)}
                                    onToggleSelect={() => toggleSelect(phase.id)}
                                    onEdit={() => setEditingId(phase.id)}
                                />
                            );
                        })
                    )}
                </>
            )}

            {canEdit && phases.length > 0 && (
                <div className="border-t border-line px-4 py-2.5 text-xs text-ink-faint">
                    <Wrench size={12} className="mr-1 inline" />
                    Tipp: a csoportok dátuma és készültsége az alattuk lévő sorokból gördül fel. A
                    munkanapok mezőbe a kezdéssel együtt beírt szám kiszámolja a határidőt (hétvégék
                    és ünnepek kihagyva). A függőség jelölése pl. „1.4.2BK+1” = az 1.4.2 fázis
                    befejezése után 1 munkanappal indul.
                </div>
            )}
        </section>
    );
}
