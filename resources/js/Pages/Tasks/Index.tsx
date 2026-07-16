import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    CalendarClock,
    Columns3,
    List,
    ListChecks,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { Option, ProjectOption, TaskItem, TaskPriority, TaskStatus } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    tasks: TaskItem[];
    filters: { search: string; project: number | null; priority: string; mine: boolean };
    statuses: Record<string, string>;
    priorities: Record<string, string>;
    users: Option[];
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

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
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
    [key: string]: string | number | number[] | TaskStatus | TaskPriority;
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
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (task) {
            form.put(route('tasks.update', task.id), options);
        } else {
            form.post(route('tasks.store'), options);
        }
    };

    const destroy = () => {
        if (task && confirm(`Biztosan törli a(z) „${task.title}" feladatot?`)) {
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

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {task ? 'Feladat szerkesztése' : 'Új feladat'}
                    </DialogTitle>

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
                                rows={3}
                                className="block w-full rounded-md border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                            />
                            <InputError message={form.errors.description} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <InputLabel value="Státusz" />
                                <select
                                    value={form.data.status}
                                    onChange={(e) =>
                                        form.setData('status', e.target.value as TaskStatus)
                                    }
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
                                    onChange={(e) =>
                                        form.setData('priority', e.target.value as TaskPriority)
                                    }
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
                                <InputLabel value="Határidő" />
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
                                        form.setData(
                                            'project_id',
                                            e.target.value ? Number(e.target.value) : '',
                                        )
                                    }
                                    className={`${selectClass} w-full`}
                                >
                                    <option value="">– Nincs projekt –</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Felelős(ök)" />
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

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
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

            {(task.project || task.due_on) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                    {task.project && (
                        <span className="font-mono">{task.project.code}</span>
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
                </div>
            )}

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
    const { tasks, filters, statuses, priorities, users, projects, auth } =
        usePageProps<IndexProps>();

    const canCreate = auth.permissions.includes('tasks.create');
    const canDelete = auth.permissions.includes('tasks.delete');

    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const [modal, setModal] = useState<{ task: TaskItem | null; status: TaskStatus } | null>(null);
    const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

    const [search, setSearch] = useState(filters.search);
    const [project, setProject] = useState(filters.project ? String(filters.project) : '');
    const [priority, setPriority] = useState(filters.priority);
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
                    project: project || undefined,
                    priority: priority || undefined,
                    mine: mine ? 1 : undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, project, priority, mine]);

    const drop = (status: TaskStatus, e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(null);
        const id = Number(e.dataTransfer.getData('text/plain'));
        const task = tasks.find((t) => t.id === id);
        if (task && task.status !== status && task.can_move) {
            router.put(
                route('tasks.status', id),
                { status },
                { preserveScroll: true },
            );
        }
    };

    return (
        <>
            <Head title="Feladatok" />

            <PageHeader
                title="Feladatok / To-do"
                subtitle="Egyéni és csapatszintű feladatok — húzza át a kártyákat az oszlopok között."
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

            {/* Szűrők + nézetváltó */}
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1 lg:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Keresés a feladatok között…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>

                <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className={`${selectClass} lg:w-56`}
                >
                    <option value="">Minden projekt</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.label}
                        </option>
                    ))}
                </select>

                <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className={`${selectClass} lg:w-40`}
                >
                    <option value="">Minden prioritás</option>
                    {Object.entries(priorities).map(([v, l]) => (
                        <option key={v} value={v}>
                            {l}
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
                    Csak a saját feladataim
                </label>

                <div className="ml-auto flex rounded-md border border-line bg-white p-0.5">
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
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <ListChecks size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs feladat</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search || filters.project || filters.priority || filters.mine
                            ? 'A szűrésnek megfelelő feladat nincs — módosítsa a feltételeket.'
                            : 'Hozza létre az első feladatot, és kövesse kanban táblán.'}
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
                                    dragOver === status
                                        ? 'border-accent bg-accent-50'
                                        : 'border-line',
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
                <div className="o-card divide-y divide-line">
                    {[...tasks]
                        .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999'))
                        .map((task) => (
                            <button
                                key={task.id}
                                onClick={() => setModal({ task, status: task.status })}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream/50"
                            >
                                <span
                                    className={clsx(
                                        'min-w-0 flex-1 truncate text-sm font-medium',
                                        task.status === 'kesz'
                                            ? 'text-ink-faint line-through'
                                            : 'text-ink',
                                    )}
                                >
                                    {task.title}
                                </span>
                                {task.project && (
                                    <span className="hidden font-mono text-xs text-ink-faint sm:block">
                                        {task.project.code}
                                    </span>
                                )}
                                <span className={clsx('chip', PRIORITY_CHIP[task.priority])}>
                                    {priorities[task.priority]}
                                </span>
                                <span
                                    className={clsx(
                                        'hidden w-24 text-right text-xs sm:block',
                                        task.is_overdue ? 'font-medium text-coral' : 'text-ink-faint',
                                    )}
                                >
                                    {fmtDate(task.due_on)}
                                </span>
                                <span className="chip chip-grey w-24 justify-center">
                                    {statuses[task.status]}
                                </span>
                            </button>
                        ))}
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
