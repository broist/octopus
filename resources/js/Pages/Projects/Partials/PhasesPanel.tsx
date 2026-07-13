import { useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import ProgressBar from '@/Components/ProgressBar';
import { fmtDate } from '@/lib/format';
import type { PhaseItem } from '@/types/models';

interface PhaseFormData {
    name: string;
    starts_on: string;
    due_on: string;
    progress: number;
    depends_on: number[];
    [key: string]: string | number | number[];
}

function DependsPicker({
    options,
    value,
    onChange,
}: {
    options: PhaseItem[];
    value: number[];
    onChange: (ids: number[]) => void;
}) {
    if (options.length === 0) {
        return <p className="text-xs text-ink-faint">Még nincs másik fázis, amire várhatna.</p>;
    }

    const toggle = (id: number) =>
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
            {options.map((o) => (
                <label key={o.id} className="flex items-center gap-1.5 text-sm text-ink-soft">
                    <input
                        type="checkbox"
                        checked={value.includes(o.id)}
                        onChange={() => toggle(o.id)}
                        className="rounded-sm border-line text-accent focus:ring-accent/40"
                    />
                    {o.name}
                </label>
            ))}
        </div>
    );
}

function PhaseFields({
    form,
    options,
}: {
    form: ReturnType<typeof useForm<PhaseFormData>>;
    options: PhaseItem[];
}) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
                <InputLabel value="Fázis neve *" />
                <TextInput
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    placeholder="pl. Alapozás"
                />
                <InputError message={form.errors.name} />
            </div>
            <div>
                <InputLabel value="Kezdés" />
                <TextInput
                    type="date"
                    value={form.data.starts_on}
                    onChange={(e) => form.setData('starts_on', e.target.value)}
                />
                <InputError message={form.errors.starts_on} />
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
            <div className="sm:col-span-2">
                <InputLabel value={`Készültség: ${form.data.progress}%`} />
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={form.data.progress}
                    onChange={(e) => form.setData('progress', Number(e.target.value))}
                    className="mt-2 w-full accent-[#2E6B4F]"
                />
                <InputError message={form.errors.progress} />
            </div>
            <div className="sm:col-span-2">
                <InputLabel value="Erre vár (függőségek)" />
                <div className="mt-1">
                    <DependsPicker
                        options={options}
                        value={form.data.depends_on}
                        onChange={(ids) => form.setData('depends_on', ids)}
                    />
                </div>
                <InputError message={form.errors.depends_on as string | undefined} />
            </div>
        </div>
    );
}

function PhaseRow({
    phase,
    allPhases,
    canEdit,
    isFirst,
    isLast,
}: {
    phase: PhaseItem;
    allPhases: PhaseItem[];
    canEdit: boolean;
    isFirst: boolean;
    isLast: boolean;
}) {
    const [editing, setEditing] = useState(false);

    const form = useForm<PhaseFormData>({
        name: phase.name,
        starts_on: phase.starts_on ?? '',
        due_on: phase.due_on ?? '',
        progress: phase.progress,
        depends_on: phase.depends_on,
    });

    const save = () => {
        form.put(route('projects.phases.update', phase.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    const move = (direction: 'up' | 'down') => {
        router.post(
            route('projects.phases.move', phase.id),
            { direction },
            { preserveScroll: true },
        );
    };

    const remove = () => {
        if (confirm(`Biztosan törli a(z) „${phase.name}" fázist?`)) {
            router.delete(route('projects.phases.destroy', phase.id), {
                preserveScroll: true,
            });
        }
    };

    const dependencyNames = phase.depends_on
        .map((id) => allPhases.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');

    if (editing) {
        return (
            <div className="border-t border-line bg-cream/50 px-4 py-4">
                <PhaseFields
                    form={form}
                    options={allPhases.filter((p) => p.id !== phase.id)}
                />
                <div className="mt-4 flex gap-2">
                    <button
                        className="btn-primary px-4 py-1.5 text-xs"
                        onClick={save}
                        disabled={form.processing}
                    >
                        Mentés
                    </button>
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
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{phase.name}</span>
                    {phase.is_overdue && <span className="chip chip-coral">Csúszik</span>}
                    {phase.progress === 100 && <span className="chip chip-green">Kész</span>}
                </div>
                <div className="mt-0.5 text-xs text-ink-faint">
                    {fmtDate(phase.starts_on)} – {fmtDate(phase.due_on)}
                    {dependencyNames && <span> · erre vár: {dependencyNames}</span>}
                </div>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-56">
                <ProgressBar value={phase.progress} warn={phase.is_overdue} className="flex-1" />
                <span className="w-9 text-right text-xs font-medium text-ink-soft">
                    {phase.progress}%
                </span>
            </div>

            {canEdit && (
                <div className="flex items-center gap-0.5 text-ink-faint">
                    <button
                        onClick={() => move('up')}
                        disabled={isFirst}
                        className="rounded p-1.5 hover:bg-cream hover:text-ink disabled:opacity-30"
                        aria-label="Feljebb"
                    >
                        <ArrowUp size={15} />
                    </button>
                    <button
                        onClick={() => move('down')}
                        disabled={isLast}
                        className="rounded p-1.5 hover:bg-cream hover:text-ink disabled:opacity-30"
                        aria-label="Lejjebb"
                    >
                        <ArrowDown size={15} />
                    </button>
                    <button
                        onClick={() => setEditing(true)}
                        className="rounded p-1.5 hover:bg-cream hover:text-ink"
                        aria-label="Szerkesztés"
                    >
                        <Pencil size={15} />
                    </button>
                    <button
                        onClick={remove}
                        className="rounded p-1.5 hover:bg-coral/10 hover:text-coral"
                        aria-label="Törlés"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            )}
        </div>
    );
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
        progress: 0,
        depends_on: [],
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
                    />
                ))
            )}
        </section>
    );
}
