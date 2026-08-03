import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ChevronDown, Columns3, Eye, List, Search, SlidersHorizontal, X } from 'lucide-react';
import clsx from 'clsx';
import type { Option, ProjectOption, TaskStatus } from '@/types/models';

export type TaskScope = '' | 'project' | 'internal';

export type SortKey =
    | 'due_asc'
    | 'due_desc'
    | 'name'
    | 'assignee'
    | 'project'
    | 'created_desc'
    | 'completed_desc';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'due_asc', label: 'Határidő ↑ (legközelebbi elöl)' },
    { value: 'due_desc', label: 'Határidő ↓ (legtávolabbi elöl)' },
    { value: 'name', label: 'Név szerint (A→Z)' },
    { value: 'assignee', label: 'Felelős szerint' },
    { value: 'project', label: 'Projekt szerint' },
    { value: 'created_desc', label: 'Legújabban létrehozott' },
    { value: 'completed_desc', label: 'Legutóbb lezárt' },
];

/** A szűrősor teljes állapota — az Index tartja, innen csak módosítjuk. */
export interface TaskFilterState {
    search: string;
    project: string;
    priority: string;
    creator: string;
    assignee: string;
    scope: TaskScope;
    mine: boolean;
    /** Azok az állapotok, amiket a felhasználó NEM akar látni. */
    hidden: TaskStatus[];
    doneFrom: string;
    doneTo: string;
}

export const EMPTY_FILTERS: Omit<TaskFilterState, 'hidden'> = {
    search: '',
    project: '',
    priority: '',
    creator: '',
    assignee: '',
    scope: '',
    mine: false,
    doneFrom: '',
    doneTo: '',
};

const selectClass =
    'w-full rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30';

const panelClass =
    'absolute right-0 z-30 mt-2 origin-top-right rounded-xl border border-line bg-white p-3 shadow-lg focus:outline-none';

const triggerClass =
    'flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-accent/40 hover:text-ink';

/* ------------------------------------------------------------------ */

export default function TaskToolbar({
    value,
    onChange,
    onReset,
    statuses,
    priorities,
    users,
    creators,
    projects,
    scopeCounts,
    statusCounts,
    view,
    onViewChange,
    sort,
    onSortChange,
}: {
    value: TaskFilterState;
    onChange: (patch: Partial<TaskFilterState>) => void;
    onReset: () => void;
    statuses: Record<string, string>;
    priorities: Record<string, string>;
    users: Option[];
    creators: Option[];
    projects: ProjectOption[];
    scopeCounts: { all: number; project: number; internal: number };
    statusCounts: Record<string, number>;
    view: 'kanban' | 'list';
    onViewChange: (v: 'kanban' | 'list') => void;
    sort: SortKey;
    onSortChange: (s: SortKey) => void;
}) {
    const showDone = !value.hidden.includes('kesz');

    // Az „egyéb" szűrők közül hány aktív — ennyit jelez a Szűrők gomb.
    const activeExtra = [
        value.scope !== '',
        value.project !== '',
        value.assignee !== '',
        value.priority !== '',
        value.creator !== '',
        value.mine,
        value.doneFrom !== '',
        value.doneTo !== '',
    ].filter(Boolean).length;

    // Aktív szűrők chipként, egyenként levehetően.
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (value.search) {
        chips.push({
            key: 'search',
            label: `Keresés: „${value.search}”`,
            clear: () => onChange({ search: '' }),
        });
    }
    value.hidden.forEach((s) =>
        chips.push({
            key: `hidden-${s}`,
            label: `${statuses[s] ?? s} elrejtve`,
            clear: () => onChange({ hidden: value.hidden.filter((h) => h !== s) }),
        }),
    );
    if (value.scope) {
        chips.push({
            key: 'scope',
            label: value.scope === 'project' ? 'Projektfeladatok' : 'Belső feladatok',
            clear: () => onChange({ scope: '' }),
        });
    }
    if (value.project) {
        chips.push({
            key: 'project',
            label: projects.find((p) => String(p.id) === value.project)?.label ?? 'Projekt',
            clear: () => onChange({ project: '' }),
        });
    }
    if (value.assignee) {
        chips.push({
            key: 'assignee',
            label: `Felelős: ${users.find((u) => String(u.id) === value.assignee)?.name ?? ''}`,
            clear: () => onChange({ assignee: '' }),
        });
    }
    if (value.priority) {
        chips.push({
            key: 'priority',
            label: `Prioritás: ${priorities[value.priority] ?? value.priority}`,
            clear: () => onChange({ priority: '' }),
        });
    }
    if (value.creator) {
        chips.push({
            key: 'creator',
            label: `Létrehozó: ${creators.find((c) => String(c.id) === value.creator)?.name ?? ''}`,
            clear: () => onChange({ creator: '' }),
        });
    }
    if (value.mine) {
        chips.push({ key: 'mine', label: 'Csak a sajátjaim', clear: () => onChange({ mine: false }) });
    }
    if (value.doneFrom || value.doneTo) {
        chips.push({
            key: 'done-range',
            label: `Lezárva: ${value.doneFrom || '…'} – ${value.doneTo || '…'}`,
            clear: () => onChange({ doneFrom: '', doneTo: '' }),
        });
    }

    const toggleHidden = (status: TaskStatus) =>
        onChange({
            hidden: value.hidden.includes(status)
                ? value.hidden.filter((h) => h !== status)
                : [...value.hidden, status],
        });

    const hiddenLabel =
        value.hidden.length === 0
            ? 'Minden állapot'
            : value.hidden.length === 1
              ? `${statuses[value.hidden[0]] ?? ''} rejtve`
              : `${value.hidden.length} állapot rejtve`;

    return (
        <div className="o-card mb-5 p-3">
            <div className="flex flex-wrap items-center gap-2">
                {/* Kereső */}
                <div className="relative min-w-[200px] flex-1">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={value.search}
                        onChange={(e) => onChange({ search: e.target.value })}
                        placeholder="Keresés feladat neve szerint…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>

                {/* Állapot: mit ne mutasson */}
                <Popover className="relative">
                    <PopoverButton
                        className={clsx(
                            triggerClass,
                            value.hidden.length > 0 && 'border-accent/40 text-ink',
                        )}
                        title="Válassza ki, mely állapotokat ne mutassa"
                    >
                        <Eye size={15} className="text-ink-faint" />
                        {hiddenLabel}
                        <ChevronDown size={13} className="text-ink-faint" />
                    </PopoverButton>
                    <PopoverPanel className={clsx(panelClass, 'w-64')}>
                        <p className="px-1 pb-2 text-xs text-ink-faint">
                            Pipálja be, amelyik állapotot <b>nem</b> szeretné látni.
                        </p>
                        <div className="space-y-0.5">
                            {Object.entries(statuses).map(([key, label]) => {
                                const isHidden = value.hidden.includes(key as TaskStatus);
                                return (
                                    <label
                                        key={key}
                                        className={clsx(
                                            'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-cream',
                                            isHidden ? 'text-ink-faint' : 'text-ink',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isHidden}
                                            onChange={() => toggleHidden(key as TaskStatus)}
                                            className="rounded-sm border-line text-accent focus:ring-accent/40"
                                        />
                                        <span className={clsx('flex-1', isHidden && 'line-through')}>
                                            {label}
                                        </span>
                                        <span className="rounded-sm bg-cream px-1.5 py-0.5 text-[11px] text-ink-faint">
                                            {statusCounts[key] ?? 0}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        {value.hidden.length > 0 && (
                            <button
                                onClick={() => onChange({ hidden: [] })}
                                className="mt-2 w-full rounded-md border border-line py-1.5 text-xs font-medium text-ink-soft hover:border-accent/40 hover:text-accent"
                            >
                                Mindet megmutat
                            </button>
                        )}
                    </PopoverPanel>
                </Popover>

                {/* További szűrők egy helyen */}
                <Popover className="relative">
                    <PopoverButton
                        className={clsx(triggerClass, activeExtra > 0 && 'border-accent/40 text-ink')}
                    >
                        <SlidersHorizontal size={15} className="text-ink-faint" />
                        Szűrők
                        {activeExtra > 0 && (
                            <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">
                                {activeExtra}
                            </span>
                        )}
                        <ChevronDown size={13} className="text-ink-faint" />
                    </PopoverButton>
                    <PopoverPanel className={clsx(panelClass, 'w-[22rem] space-y-3')}>
                        {/* Hatókör */}
                        <div>
                            <p className="mb-1 text-xs font-medium text-ink-faint">Hatókör</p>
                            <div className="flex rounded-md border border-line p-0.5">
                                {(
                                    [
                                        { v: '' as TaskScope, l: 'Összes', c: scopeCounts.all },
                                        { v: 'project' as TaskScope, l: 'Projekt', c: scopeCounts.project },
                                        { v: 'internal' as TaskScope, l: 'Belső', c: scopeCounts.internal },
                                    ]
                                ).map((o) => (
                                    <button
                                        key={o.v || 'all'}
                                        // Belső hatókörben a projektszűrő értelmetlen — ki is ürítjük.
                                        onClick={() =>
                                            onChange(
                                                o.v === 'internal'
                                                    ? { scope: o.v, project: '' }
                                                    : { scope: o.v },
                                            )
                                        }
                                        className={clsx(
                                            'flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition',
                                            value.scope === o.v
                                                ? 'bg-accent text-white'
                                                : 'text-ink-soft hover:text-ink',
                                        )}
                                    >
                                        {o.l}
                                        <span
                                            className={clsx(
                                                'rounded-sm px-1 text-[10px]',
                                                value.scope === o.v
                                                    ? 'bg-white/20'
                                                    : 'bg-cream text-ink-faint',
                                            )}
                                        >
                                            {o.c}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {value.scope !== 'internal' && (
                            <div>
                                <p className="mb-1 text-xs font-medium text-ink-faint">Projekt</p>
                                <select
                                    value={value.project}
                                    onChange={(e) => onChange({ project: e.target.value })}
                                    className={selectClass}
                                >
                                    <option value="">Minden projekt</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                                <p className="mb-1 text-xs font-medium text-ink-faint">Felelős</p>
                                <select
                                    value={value.assignee}
                                    onChange={(e) => onChange({ assignee: e.target.value })}
                                    className={selectClass}
                                >
                                    <option value="">Mindenki</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <p className="mb-1 text-xs font-medium text-ink-faint">Prioritás</p>
                                <select
                                    value={value.priority}
                                    onChange={(e) => onChange({ priority: e.target.value })}
                                    className={selectClass}
                                >
                                    <option value="">Mindegy</option>
                                    {Object.entries(priorities).map(([v, l]) => (
                                        <option key={v} value={v}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <p className="mb-1 text-xs font-medium text-ink-faint">Létrehozó</p>
                            <select
                                value={value.creator}
                                onChange={(e) => onChange({ creator: e.target.value })}
                                className={selectClass}
                            >
                                <option value="">Bárki</option>
                                {creators.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lezárási dátum — csak ha a Kész látszik */}
                        {showDone && (
                            <div>
                                <p className="mb-1 text-xs font-medium text-ink-faint">
                                    Lezárva (kész feladatok)
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="date"
                                        value={value.doneFrom}
                                        onChange={(e) => onChange({ doneFrom: e.target.value })}
                                        className={selectClass}
                                    />
                                    <span className="text-xs text-ink-faint">–</span>
                                    <input
                                        type="date"
                                        value={value.doneTo}
                                        onChange={(e) => onChange({ doneTo: e.target.value })}
                                        className={selectClass}
                                    />
                                </div>
                            </div>
                        )}

                        <label className="flex cursor-pointer items-center gap-2 border-t border-line pt-2.5 text-sm text-ink-soft">
                            <input
                                type="checkbox"
                                checked={value.mine}
                                onChange={(e) => onChange({ mine: e.target.checked })}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            Csak a sajátjaim
                        </label>
                    </PopoverPanel>
                </Popover>

                {/* Rendezés csak listanézetben (a kanbanban a státusz rendez) */}
                {view === 'list' && (
                    <select
                        value={sort}
                        onChange={(e) => onSortChange(e.target.value as SortKey)}
                        className="rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30 lg:w-56"
                        title="Rendezés"
                    >
                        {SORT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                )}

                {/* Nézetváltó — a kanban az elsődleges */}
                <div className="flex rounded-md border border-line bg-white p-0.5">
                    <button
                        onClick={() => onViewChange('kanban')}
                        className={clsx(
                            'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition',
                            view === 'kanban' ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink',
                        )}
                    >
                        <Columns3 size={14} />
                        Kanban
                    </button>
                    <button
                        onClick={() => onViewChange('list')}
                        className={clsx(
                            'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition',
                            view === 'list' ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink',
                        )}
                    >
                        <List size={14} />
                        Lista
                    </button>
                </div>
            </div>

            {/* Aktív szűrők chipként */}
            {chips.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                    {chips.map((chip) => (
                        <span
                            key={chip.key}
                            className="flex items-center gap-1 rounded-md bg-cream px-2 py-1 text-xs text-ink-soft"
                        >
                            {chip.label}
                            <button
                                onClick={chip.clear}
                                className="rounded-sm text-ink-faint hover:text-coral"
                                title="Szűrő eltávolítása"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                    <button
                        onClick={onReset}
                        className="ml-1 text-xs font-medium text-accent hover:underline"
                        title="Minden szűrő törlése, az elrejtett állapotokkal együtt"
                    >
                        Összes szűrő törlése
                    </button>
                </div>
            )}
        </div>
    );
}
