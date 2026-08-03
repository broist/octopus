import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    CalendarClock,
    EyeOff,
    ImageIcon,
    ListChecks,
    MessageSquare,
    Paperclip,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import TaskTimeline from './Partials/TaskTimeline';
import TaskToolbar, {
    EMPTY_FILTERS,
    type SortKey,
    type TaskFilterState,
    type TaskScope,
} from './Partials/TaskToolbar';
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
        /** Az elrejtett állapotok — ezeket nem kéri a felhasználó. */
        hidden: TaskStatus[];
        done_from: string;
        done_to: string;
    };
    scopeCounts: { all: number; project: number; internal: number };
    statusCounts: Record<string, number>;
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

/** A nézetválasztás (kanban/lista) felhasználónként megmarad. */
const VIEW_STORAGE_KEY = 'octopus.tasks.view';

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
            <div className="fixed inset-0 flex justify-center overflow-y-auto p-3 sm:p-4">
                <DialogPanel className={clsx('o-card m-auto w-full p-4 sm:p-6', task ? 'max-w-2xl' : 'max-w-lg')}>
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

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

                    {/* Idővonal csak meglévő feladatnál — új feladatnak még nincs id-je. */}
                    {task && (
                        <div className="mt-5">
                            <TaskTimeline taskId={task.id} statuses={statuses} />
                        </div>
                    )}
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
                    {task.comments_count > 0 && (
                        <span className="flex items-center gap-1" title="Hozzászólások">
                            <MessageSquare size={11} />
                            {task.comments_count}
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
    const {
        tasks,
        filters,
        scopeCounts,
        statusCounts,
        statuses,
        priorities,
        users,
        creators,
        projects,
        auth,
    } = usePageProps<IndexProps>();

    const canCreate = auth.permissions.includes('tasks.create');
    const canDelete = auth.permissions.includes('tasks.delete');

    // A kanban az elsődleges nézet; a választás felhasználónként megmarad.
    const [view, setView] = useState<'kanban' | 'list'>(
        () => (localStorage.getItem(VIEW_STORAGE_KEY) as 'kanban' | 'list') || 'kanban',
    );
    const [sort, setSort] = useState<SortKey>('due_asc');
    const [modal, setModal] = useState<{ task: TaskItem | null; status: TaskStatus } | null>(null);
    const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

    const [f, setF] = useState<TaskFilterState>({
        search: filters.search,
        project: filters.project ? String(filters.project) : '',
        priority: filters.priority,
        creator: filters.creator ? String(filters.creator) : '',
        assignee: filters.assignee ? String(filters.assignee) : '',
        scope: filters.scope,
        mine: filters.mine,
        hidden: filters.hidden,
        doneFrom: filters.done_from,
        doneTo: filters.done_to,
    });
    const patch = (p: Partial<TaskFilterState>) => setF((s) => ({ ...s, ...p }));
    const firstRender = useRef(true);

    const changeView = (v: 'kanban' | 'list') => {
        setView(v);
        localStorage.setItem(VIEW_STORAGE_KEY, v);
    };

    const showDone = !f.hidden.includes('kesz');
    const visibleStatuses = STATUS_ORDER.filter((s) => !f.hidden.includes(s));
    const hiddenStatuses = STATUS_ORDER.filter((s) => f.hidden.includes(s));

    const resetFilters = () => setF({ ...EMPTY_FILTERS, hidden: [] });

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('tasks.index'),
                {
                    search: f.search || undefined,
                    // Belső hatókörben a projektszűrő nem értelmezett.
                    project: f.scope === 'internal' ? undefined : f.project || undefined,
                    priority: f.priority || undefined,
                    creator: f.creator || undefined,
                    assignee: f.assignee || undefined,
                    scope: f.scope || undefined,
                    mine: f.mine ? 1 : undefined,
                    // Mindig kiírjuk (üresen is), különben a szerver az
                    // alapértelmezést (Kész elrejtve) állítaná vissza.
                    hidden: f.hidden.join(','),
                    // A lezárási dátumszűrőnek csak látható Kész mellett van értelme.
                    done_from: showDone ? f.doneFrom || undefined : undefined,
                    done_to: showDone ? f.doneTo || undefined : undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [f]);

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
            case 'completed_desc':
                return copy.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
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

    // Hány feladat esik az éppen elrejtett állapotokba — ha csak azok miatt
    // üres a nézet, azt írjuk ki, ne az „első feladat" szöveget.
    const hiddenTaskCount = hiddenStatuses.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);

    const emptyStateText = (() => {
        if (hiddenTaskCount > 0 && !hasOtherFilters) {
            return `Nincs látható feladat — ${hiddenTaskCount} feladat az elrejtett állapotokban van. Az Állapot szűrőben visszakapcsolhatja őket.`;
        }
        if (filters.scope === 'internal' && !hasOtherFilters) {
            return 'Még nincs belső feladat. Vegyen fel egyet projekt nélkül — csak a cégen belüli teendőkhöz.';
        }
        if (hasFilters) {
            return 'A szűrésnek megfelelő feladat nincs — módosítsa a feltételeket.';
        }
        return 'Hozza létre az első feladatot, és kövesse kanban táblán vagy listán.';
    })();

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

            <TaskToolbar
                value={f}
                onChange={patch}
                onReset={resetFilters}
                statuses={statuses}
                priorities={priorities}
                users={users}
                creators={creators}
                projects={projects}
                scopeCounts={scopeCounts}
                statusCounts={statusCounts}
                view={view}
                onViewChange={changeView}
                sort={sort}
                onSortChange={setSort}
            />

            {tasks.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <ListChecks size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs látható feladat</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">{emptyStateText}</p>
                </div>
            ) : view === 'kanban' ? (
                <div
                    className={clsx(
                        'grid grid-cols-1 gap-4',
                        visibleStatuses.length === 1 && 'md:grid-cols-1',
                        visibleStatuses.length === 2 && 'md:grid-cols-2',
                        visibleStatuses.length >= 3 && 'md:grid-cols-3',
                    )}
                >
                    {visibleStatuses.map((status) => {
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

                    {/* Elrejtett állapotok: keskeny ledobó sáv, hogy a húzással
                        való státuszváltás (pl. lezárás) elrejtve is működjön. */}
                    {hiddenStatuses.length > 0 && (
                        <div className="flex gap-2 md:col-span-full">
                            {hiddenStatuses.map((status) => (
                                <div
                                    key={status}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOver(status);
                                    }}
                                    onDragLeave={() => setDragOver(null)}
                                    onDrop={(e) => drop(status, e)}
                                    className={clsx(
                                        'flex flex-1 items-center justify-center gap-1.5 rounded-card border border-dashed py-2 text-xs transition',
                                        dragOver === status
                                            ? 'border-accent bg-accent-50 text-accent'
                                            : 'border-line text-ink-faint',
                                    )}
                                >
                                    <EyeOff size={13} />
                                    {statuses[status]} (rejtve, {statusCounts[status] ?? 0}) — húzza
                                    ide az áthelyezéshez
                                </div>
                            ))}
                        </div>
                    )}
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
                                {showDone && <th className="px-3 py-2.5 font-semibold">Lezárva</th>}
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
                                            {task.comments_count > 0 && (
                                                <span
                                                    className="flex items-center gap-0.5 text-xs text-ink-faint"
                                                    title={`${task.comments_count} hozzászólás`}
                                                >
                                                    <MessageSquare size={12} />
                                                    {task.comments_count}
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
                                    {showDone && (
                                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-faint">
                                            {task.completed_at ? fmtDate(task.completed_at) : '–'}
                                        </td>
                                    )}
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
