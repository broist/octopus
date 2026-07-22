import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    CalendarClock,
    Columns3,
    ImageIcon,
    List,
    ListChecks,
    Paperclip,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtBytes, fmtDate, fmtDateTime } from '@/lib/format';
import type {
    Option,
    ProjectOption,
    TaskAttachment,
    TaskItem,
    TaskPriority,
    TaskStatus,
} from '@/types/models';

type TaskScope = '' | 'project' | 'internal';

interface IndexProps extends Record<string, unknown> {
    tasks: TaskItem[];
    filters: {
        search: string;
        project: number | null;
        priority: string;
        creator: number | null;
        assignee: number | null;
        scope: TaskScope;
        mine: boolean;
    };
    scopeCounts: { all: number; project: number; internal: number };
    statuses: Record<string, string>;
    priorities: Record<string, string>;
    users: Option[];
    creators: Option[];
    projects: ProjectOption[];
}

const selectClass =
    'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

const PRIORITY_CHIP: Record<TaskPriority, string> = {
    magas: 'chip-coral',
    kozepes: 'chip-amber',
    alacsony: 'chip-grey',
};

const STATUS_ORDER: TaskStatus[] = ['teendo', 'folyamatban', 'kesz'];

type SortKey = 'due_asc' | 'due_desc' | 'name' | 'assignee' | 'project' | 'created_desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'due_asc', label: 'Határidő ↑ (legközelebbi elöl)' },
    { value: 'due_desc', label: 'Határidő ↓ (legtávolabbi elöl)' },
    { value: 'name', label: 'Név szerint (A→Z)' },
    { value: 'assignee', label: 'Felelős szerint' },
    { value: 'project', label: 'Projekt szerint' },
    { value: 'created_desc', label: 'Legújabban létrehozott' },
];

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
}

function firstAssignee(t: TaskItem): string {
    return t.assignees[0]?.name ?? '';
}

/* ------------------------------------------------------------------ */
/* Feladat létrehozó / szerkesztő modal                                */
/* ------------------------------------------------------------------ */

interface TaskFormData {
    title: string;
    description: string;
    project_id: number | '';
    status: TaskStatus;
    priority: TaskPriority;
    due_on: string;
    assignees: number[];
    attachments: File[];
    remove_attachments: number[];
    [key: string]: string | number | number[] | File[] | TaskStatus | TaskPriority;
}

function TaskModal({
    task,
    presetStatus,
    users,
    projects,
    statuses,
    priorities,
    canDelete,
    onClose,
}: {
    task: TaskItem | null;
    presetStatus: TaskStatus;
    users: Option[];
    projects: ProjectOption[];
    statuses: Record<string, string>;
    priorities: Record<string, string>;
    canDelete: boolean;
    onClose: () => void;
}) {
    const form = useForm<TaskFormData>({
        title: task?.title ?? '',
        description: task?.description ?? '',
        project_id: task?.project?.id ?? '',
        status: task?.status ?? presetStatus,
        priority: task?.priority ?? 'kozepes',
        due_on: task?.due_on ?? '',
        assignees: task?.assignees.map((a) => a.id) ?? [],
        attachments: [],
        remove_attachments: [],
    });

    // Meglévő csatolmányok (szerkesztéskor), a törlésre jelölteket kihagyva.
    const existing = (task?.attachments ?? []).filter(
        (a) => !form.data.remove_attachments.includes(a.id),
    );

    const isValid =
        form.data.title.trim() !== '' &&
        form.data.due_on !== '' &&
        form.data.assignees.length > 0;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { forceFormData: true, preserveScroll: true, onSuccess: onClose };
        if (task) {
            form.transform((d) => ({ ...d, _method: 'put' }));
            form.post(route('tasks.update', task.id), options);
        } else {
            form.transform((d) => d);
            form.post(route('tasks.store'), options);
        }
    };

    const destroy = () => {
        if (task && confirm(`Biztosan törli a(z) „${task.title}” feladatot?`)) {
            router.delete(route('tasks.destroy', task.id), {
                preserveScroll: true,
                onSuccess: onClose,
            });
        }
    };

    const toggleAssignee = (id: number) =>
        form.setData(
            'assignees',
            form.data.assignees.includes(id)
                ? form.data.assignees.filter((a) => a !== id)
                : [...form.data.assignees, id],
        );

    const addFiles = (files: FileList | null) => {
        if (!files) return;
        form.setData('attachments', [...form.data.attachments, ...Array.from(files)]);
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {task ? 'Feladat szerkesztése' : 'Új feladat'}
                    </DialogTitle>

                    {/* Létrehozó + dátum (szerkesztéskor) */}
                    {task && task.creator && (
                        <p className="mt-1 text-xs text-ink-faint">
                            Létrehozta: <span className="font-medium text-ink-soft">{task.creator.name}</span> ·{' '}
                            {fmtDateTime(task.created_at)}
                        </p>
                    )}

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Cím *" />
                            <TextInput
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                isFocused
                            />
                            <InputError message={form.errors.title} />
                        </div>

                        <div>
                            <InputLabel value="Leírás" />
                            <textarea
                                value={form.data.description}
                                onChange={(e) => form.setData('description', e.target.value)}
                                rows={2}
                                className="block w-full rounded-md border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <InputLabel value="Státusz" />
                                <select
                                    value={form.data.status}
                                    onChange={(e) => form.setData('status', e.target.value as TaskStatus)}
                                    className={`${selectClass} w-full`}
                                >
                                    {Object.entries(statuses).map(([v, l]) => (
                                        <option key={v} value={v}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <InputLabel value="Prioritás" />
                                <select
                                    value={form.data.priority}
                                    onChange={(e) => form.setData('priority', e.target.value as TaskPriority)}
                                    className={`${selectClass} w-full`}
                                >
                                    {Object.entries(priorities).map(([v, l]) => (
                                        <option key={v} value={v}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <InputLabel value="Határidő *" />
                                <TextInput
                                    type="date"
                                    value={form.data.due_on}
                                    onChange={(e) => form.setData('due_on', e.target.value)}
                                />
                                <InputError message={form.errors.due_on} />
                            </div>
                            <div>
                                <InputLabel value="Projekt" />
                                <select
                                    value={form.data.project_id}
                                    onChange={(e) =>
                                        form.setData('project_id', e.target.value ? Number(e.target.value) : '')
                                    }
                                    className={`${selectClass} w-full`}
                                >
                                    <option value="">Belső feladat (nincs projekt)</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Felelős(ök) *" />
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
                                {users.map((u) => (
                                    <label
                                        key={u.id}
                                        className="flex items-center gap-1.5 text-sm text-ink-soft"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.data.assignees.includes(u.id)}
                                            onChange={() => toggleAssignee(u.id)}
                                            className="rounded-sm border-line text-accent focus:ring-accent/40"
                                        />
                                        {u.name}
                                    </label>
                                ))}
                            </div>
                            <InputError message={form.errors.assignees} />
                        </div>

                        {/* Csatolmányok */}
                        <div>
                            <InputLabel value="Csatolmányok (fájl vagy kép)" />
                            <div className="space-y-1.5">
                                {existing.map((a: TaskAttachment) => (
                                    <div
                                        key={`ex-${a.id}`}
                                        className="flex items-center gap-2 rounded-md border border-line bg-cream/40 px-2.5 py-1.5 text-sm"
                                    >
                                        {a.is_image ? (
                                            <ImageIcon size={14} className="shrink-0 text-ink-faint" />
                                        ) : (
                                            <Paperclip size={14} className="shrink-0 text-ink-faint" />
                                        )}
                                        <a
                                            href={a.url}
                                            className="min-w-0 flex-1 truncate text-accent hover:underline"
                                        >
                                            {a.name}
                                        </a>
                                        <span className="shrink-0 text-xs text-ink-faint">{fmtBytes(a.size)}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                form.setData('remove_attachments', [
                                                    ...form.data.remove_attachments,
                                                    a.id,
                                                ])
                                            }
                                            className="shrink-0 rounded p-0.5 text-ink-faint hover:text-coral"
                                            title="Eltávolítás"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                {form.data.attachments.map((f, i) => (
                                    <div
                                        key={`new-${i}`}
                                        className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-50/40 px-2.5 py-1.5 text-sm"
                                    >
                                        <Paperclip size={14} className="shrink-0 text-accent" />
                                        <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                                        <span className="shrink-0 text-xs text-ink-faint">{fmtBytes(f.size)}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'attachments',
                                                    form.data.attachments.filter((_, idx) => idx !== i),
                                                )
                                            }
                                            className="shrink-0 rounded p-0.5 text-ink-faint hover:text-coral"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-accent/40 hover:text-accent">
                                <Paperclip size={13} />
                                Fájl / kép hozzáadása
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        addFiles(e.target.files);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                            <InputError
                                message={
                                    Object.entries(form.errors).find(([k]) =>
                                        k.startsWith('attachments'),
                                    )?.[1]
                                }
                            />
                        </div>

                        {form.progress && (
                            <div className="h-1.5 overflow-hidden rounded-sm bg-line">
                                <div
                                    className="h-full bg-accent transition-all"
                                    style={{ width: `${form.progress.percentage ?? 0}%` }}
                                />
                            </div>
                        )}

                        {!isValid && (
                            <p className="text-xs text-ink-faint">
                                A felelős és a határidő megadása kötelező a mentéshez.
                            </p>
                        )}

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={form.processing || !isValid}
                            >
                                {task ? 'Mentés' : 'Feladat létrehozása'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                            {task && canDelete && (
                                <button
                                    type="button"
                                    onClick={destroy}
                                    className="btn ml-auto inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}

/* ------------------------------------------------------------------ */
/* Kanban kártya                                                       */
/* ------------------------------------------------------------------ */

function TaskCard({
    task,
    priorities,
    onOpen,
}: {
    task: TaskItem;
    priorities: Record<string, string>;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            draggable={task.can_move}
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(task.id));
                e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={onOpen}
            className={clsx(
                'o-card w-full p-3 text-left transition hover:border-accent/40',
                task.can_move && 'cursor-grab active:cursor-grabbing',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <span
                    className={clsx(
                        'text-sm font-medium leading-snug',
                        task.status === 'kesz' ? 'text-ink-faint line-through' : 'text-ink',
                    )}
                >
                    {task.title}
                </span>
                <span className={clsx('chip shrink-0', PRIORITY_CHIP[task.priority])}>
                    {priorities[task.priority]}
                </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                    {task.project ? (
                        <span className="font-mono">{task.project.code}</span>
                    ) : (
                        <span className="chip bg-sidebar/10 text-[10px] text-sidebar">Belső</span>
                    )}
                    {task.due_on && (
                        <span
                            className={clsx(
                                'flex items-center gap-1',
                                task.is_overdue && 'font-medium text-coral',
                            )}
                        >
                            <CalendarClock size={12} />
                            {fmtDate(task.due_on)}
                        </span>
                    )}
                    {task.attachments.length > 0 && (
                        <span className="flex items-center gap-1">
                            <Paperclip size={11} />
                            {task.attachments.length}
                        </span>
                    )}
                </div>

            {task.assignees.length > 0 && (
                <div className="mt-2 flex -space-x-1.5">
                    {task.assignees.map((a) => (
                        <span
                            key={a.id}
                            title={a.name}
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-white bg-accent text-[10px] font-semibold text-white"
                        >
                            {initials(a.name)}
                        </span>
                    ))}
                </div>
            )}
        </button>
    );
}

/* ------------------------------------------------------------------ */
/* Oldal                                                               */
/* ------------------------------------------------------------------ */

export default function Index() {
    const { tasks, filters, scopeCounts, statuses, priorities, users, creators, projects, auth } =
        usePageProps<IndexProps>();

    const canCreate = auth.permissions.includes('tasks.create');
    const canDelete = auth.permissions.includes('tasks.delete');

    const [view, setView] = useState<'kanban' | 'list'>('list');
    const [sort, setSort] = useState<SortKey>('due_asc');
    const [modal, setModal] = useState<{ task: TaskItem | null; status: TaskStatus } | null>(null);
    const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

    const [search, setSearch] = useState(filters.search);
    const [project, setProject] = useState(filters.project ? String(filters.project) : '');
    const [priority, setPriority] = useState(filters.priority);
    const [creator, setCreator] = useState(filters.creator ? String(filters.creator) : '');
    const [assignee, setAssignee] = useState(filters.assignee ? String(filters.assignee) : '');
    const [scope, setScope] = useState<TaskScope>(filters.scope);
    const [mine, setMine] = useState(filters.mine);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('tasks.index'),
                {
                    search: search || undefined,
                    // Belső hatókörben a projektszűrő nem értelmezett.
                    project: scope === 'internal' ? undefined : project || undefined,
                    priority: priority || undefined,
                    creator: creator || undefined,
                    assignee: assignee || undefined,
                    scope: scope || undefined,
                    mine: mine ? 1 : undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, project, priority, creator, assignee, scope, mine]);

    const SCOPE_TABS: { value: TaskScope; label: string; count: number }[] = [
        { value: '', label: 'Összes', count: scopeCounts.all },
        { value: 'project', label: 'Projektfeladatok', count: scopeCounts.project },
        { value: 'internal', label: 'Belső feladatok', count: scopeCounts.internal },
    ];

    const sortedTasks = useMemo(() => {
        const copy = [...tasks];
        const byDue = (a: TaskItem, b: TaskItem) =>
            (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999');
        switch (sort) {
            case 'due_desc':
                return copy.sort((a, b) => byDue(b, a));
            case 'name':
                return copy.sort((a, b) => a.title.localeCompare(b.title, 'hu'));
            case 'assignee':
                return copy.sort(
                    (a, b) => firstAssignee(a).localeCompare(firstAssignee(b), 'hu') || byDue(a, b),
                );
            case 'project':
                return copy.sort(
                    (a, b) =>
                        (a.project?.code ?? 'zzz').localeCompare(b.project?.code ?? 'zzz') || byDue(a, b),
                );
            case 'created_desc':
                return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
            default:
                return copy.sort(byDue);
        }
    }, [tasks, sort]);

    const drop = (status: TaskStatus, e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(null);
        const id = Number(e.dataTransfer.getData('text/plain'));
        const task = tasks.find((t) => t.id === id);
        if (task && task.status !== status && task.can_move) {
            router.put(route('tasks.status', id), { status }, { preserveScroll: true });
        }
    };

    const hasOtherFilters = !!(
        filters.search ||
        filters.project ||
        filters.priority ||
        filters.creator ||
        filters.assignee ||
        filters.mine
    );
    const hasFilters = hasOtherFilters || !!filters.scope;

    return (
        <>
            <Head title="Feladatok" />

            <PageHeader
                title="Feladatok / To-do"
                subtitle="Projekthez kötött és belső feladatok együtt — ki mivel foglalkozik, kanban táblán vagy listán."
                actions={
                    canCreate && (
                        <button
                            className="btn-primary"
                            onClick={() => setModal({ task: null, status: 'teendo' })}
                        >
                            <Plus size={16} />
                            Új feladat
                        </button>
                    )
                }
            />

            {/* Hatókör-váltó: összes / projektfeladatok / belső feladatok */}
            <div className="mb-4 inline-flex rounded-md border border-line bg-white p-0.5">
                {SCOPE_TABS.map((tab) => (
                    <button
                        key={tab.value || 'all'}
                        onClick={() => setScope(tab.value)}
                        className={clsx(
                            'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition',
                            scope === tab.value ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink',
                        )}
                    >
                        {tab.label}
                        <span
                            className={clsx(
                                'rounded-sm px-1.5 py-0.5 text-[11px]',
                                scope === tab.value ? 'bg-white/20 text-white' : 'bg-cream text-ink-faint',
                            )}
                        >
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Szűrők + nézetváltó */}
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                <div className="relative flex-1 lg:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Keresés feladat neve szerint…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>

                {scope !== 'internal' && (
                    <select value={project} onChange={(e) => setProject(e.target.value)} className={`${selectClass} lg:w-48`}>
                        <option value="">Minden projekt</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                )}

                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${selectClass} lg:w-44`}>
                    <option value="">Minden felelős</option>
                    {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                        </option>
                    ))}
                </select>

                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={`${selectClass} lg:w-36`}>
                    <option value="">Minden prioritás</option>
                    {Object.entries(priorities).map(([v, l]) => (
                        <option key={v} value={v}>
                            {l}
                        </option>
                    ))}
                </select>

                <select value={creator} onChange={(e) => setCreator(e.target.value)} className={`${selectClass} lg:w-44`}>
                    <option value="">Minden létrehozó</option>
                    {creators.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                        type="checkbox"
                        checked={mine}
                        onChange={(e) => setMine(e.target.checked)}
                        className="rounded-sm border-line text-accent focus:ring-accent/40"
                    />
                    Csak a sajátjaim
                </label>

                <div className="ml-auto flex items-center gap-2">
                    {view === 'list' && (
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as SortKey)}
                            className={`${selectClass} lg:w-56`}
                            title="Rendezés"
                        >
                            {SORT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    )}
                    <div className="flex rounded-md border border-line bg-white p-0.5">
                        <button
                            onClick={() => setView('list')}
                            className={clsx(
                                'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium',
                                view === 'list' ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink',
                            )}
                        >
                            <List size={14} />
                            Lista
                        </button>
                        <button
                            onClick={() => setView('kanban')}
                            className={clsx(
                                'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium',
                                view === 'kanban' ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink',
                            )}
                        >
                            <Columns3 size={14} />
                            Kanban
                        </button>
                    </div>
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <ListChecks size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs feladat</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {scope === 'internal' && !hasOtherFilters
                            ? 'Még nincs belső feladat. Vegyen fel egyet projekt nélkül — csak a cégen belüli teendőkhöz.'
                            : hasFilters
                              ? 'A szűrésnek megfelelő feladat nincs — módosítsa a feltételeket.'
                              : 'Hozza létre az első feladatot, és kövesse listán vagy kanban táblán.'}
                    </p>
                </div>
            ) : view === 'kanban' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {STATUS_ORDER.map((status) => {
                        const column = tasks.filter((t) => t.status === status);
                        return (
                            <div
                                key={status}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOver(status);
                                }}
                                onDragLeave={() => setDragOver(null)}
                                onDrop={(e) => drop(status, e)}
                                className={clsx(
                                    'rounded-card border bg-cream/60 p-3 transition',
                                    dragOver === status ? 'border-accent bg-accent-50' : 'border-line',
                                )}
                            >
                                <div className="mb-3 flex items-center justify-between px-1">
                                    <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                                        {statuses[status]}
                                    </h2>
                                    <span className="rounded-sm bg-white px-1.5 py-0.5 text-xs font-medium text-ink-faint">
                                        {column.length}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {column.map((task) => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            priorities={priorities}
                                            onOpen={() => setModal({ task, status })}
                                        />
                                    ))}
                                    {canCreate && (
                                        <button
                                            onClick={() => setModal({ task: null, status })}
                                            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-line py-2 text-xs text-ink-faint transition hover:border-accent/40 hover:text-accent"
                                        >
                                            <Plus size={13} />
                                            Feladat ide
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Listás nézet — oszlopfejlécekkel */
                <div className="o-card overflow-x-auto">
                    <table className="w-full min-w-[860px] border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-line bg-cream/60 text-left text-[11px] uppercase tracking-wide text-ink-faint">
                                <th className="px-4 py-2.5 font-semibold">Feladat</th>
                                <th className="px-3 py-2.5 font-semibold">Projekt</th>
                                <th className="px-3 py-2.5 font-semibold">Felelős</th>
                                <th className="px-3 py-2.5 font-semibold">Létrehozó</th>
                                <th className="px-3 py-2.5 font-semibold">Létrehozva</th>
                                <th className="px-3 py-2.5 font-semibold">Határidő</th>
                                <th className="px-3 py-2.5 font-semibold">Prioritás</th>
                                <th className="px-3 py-2.5 font-semibold">Státusz</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTasks.map((task) => (
                                <tr
                                    key={task.id}
                                    onClick={() => setModal({ task, status: task.status })}
                                    className="cursor-pointer border-b border-line/70 transition hover:bg-cream/50"
                                >
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={clsx(
                                                    'font-medium',
                                                    task.status === 'kesz'
                                                        ? 'text-ink-faint line-through'
                                                        : 'text-ink',
                                                )}
                                            >
                                                {task.title}
                                            </span>
                                            {task.attachments.length > 0 && (
                                                <span
                                                    className="flex items-center gap-0.5 text-xs text-ink-faint"
                                                    title={`${task.attachments.length} csatolmány`}
                                                >
                                                    <Paperclip size={12} />
                                                    {task.attachments.length}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-ink-soft">
                                        {task.project ? (
                                            <span className="font-mono text-xs">{task.project.code}</span>
                                        ) : (
                                            <span className="chip bg-sidebar/10 text-sidebar">Belső</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        {task.assignees.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {task.assignees.map((a) => (
                                                    <span
                                                        key={a.id}
                                                        className="chip chip-grey whitespace-nowrap"
                                                    >
                                                        {a.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-ink-faint">–</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-ink-soft">
                                        {task.creator?.name ?? <span className="text-ink-faint">–</span>}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-faint">
                                        {fmtDate(task.created_at)}
                                    </td>
                                    <td
                                        className={clsx(
                                            'whitespace-nowrap px-3 py-2.5',
                                            task.is_overdue ? 'font-medium text-coral' : 'text-ink-soft',
                                        )}
                                    >
                                        {fmtDate(task.due_on)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className={clsx('chip', PRIORITY_CHIP[task.priority])}>
                                            {priorities[task.priority]}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="chip chip-grey whitespace-nowrap">
                                            {statuses[task.status]}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <TaskModal
                    task={modal.task}
                    presetStatus={modal.status}
                    users={users}
                    projects={projects}
                    statuses={statuses}
                    priorities={priorities}
                    canDelete={canDelete}
                    onClose={() => setModal(null)}
                />
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
