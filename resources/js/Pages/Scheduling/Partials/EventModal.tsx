import { useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { Trash2, TriangleAlert } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { fmtDate } from '@/lib/format';
import type { CalendarEventItem, CalendarEventType, Option, ProjectRef } from '@/types/models';

const selectClass =
    'block w-full rounded-md border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

interface EventFormData {
    title: string;
    type: CalendarEventType;
    project_id: number | '';
    starts_on: string;
    ends_on: string;
    start_time: string;
    end_time: string;
    location: string;
    note: string;
    assignees: number[];
    [key: string]: string | number | number[] | CalendarEventType;
}

interface EventModalProps {
    event: CalendarEventItem | null;
    presetDate: string;
    users: Option[];
    projects: ProjectRef[];
    types: Record<string, string>;
    canCreate: boolean;
    onClose: () => void;
}

/**
 * Naptárbejegyzés létrehozása/szerkesztése; jog nélkül csak megtekintés.
 */
export default function EventModal({
    event,
    presetDate,
    users,
    projects,
    types,
    canCreate,
    onClose,
}: EventModalProps) {
    const readOnly = event !== null && !event.can_manage;
    const [busy, setBusy] = useState(false);

    const form = useForm<EventFormData>({
        title: event?.title ?? '',
        type: event?.type ?? (canCreate ? 'beosztas' : 'szemelyes'),
        project_id: event?.project?.id ?? '',
        starts_on: event?.starts_on ?? presetDate,
        ends_on: event?.ends_on ?? presetDate,
        start_time: event?.start_time ?? '',
        end_time: event?.end_time ?? '',
        location: event?.location ?? '',
        note: event?.note ?? '',
        assignees: event?.assignees.map((a) => a.id) ?? [],
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, preserveState: true, onSuccess: onClose };
        if (event) form.put(route('scheduling.events.update', event.id), options);
        else form.post(route('scheduling.events.store'), options);
    };

    const destroy = () => {
        if (event && confirm(`Biztosan törli a(z) „${event.title}" bejegyzést?`)) {
            setBusy(true);
            router.delete(route('scheduling.events.destroy', event.id), {
                preserveScroll: true,
                preserveState: true,
                onSuccess: onClose,
                onFinish: () => setBusy(false),
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

    // Ha nincs create jog, csak személyes bejegyzést vehet fel.
    const typeOptions = Object.entries(types).filter(
        ([value]) => canCreate || event !== null || value === 'szemelyes',
    );

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {readOnly
                            ? 'Bejegyzés részletei'
                            : event
                              ? 'Bejegyzés szerkesztése'
                              : 'Új naptárbejegyzés'}
                    </DialogTitle>

                    {event?.is_conflicted && (
                        <p className="mt-2 flex items-center gap-1.5 rounded-md bg-coral/10 px-3 py-2 text-xs font-medium text-coral">
                            <TriangleAlert size={14} />
                            Ütközés: valamelyik beosztott aznap máshol is dolgozik.
                        </p>
                    )}

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Cím *" />
                            <TextInput
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                disabled={readOnly}
                                isFocused={!readOnly}
                            />
                            <InputError message={form.errors.title} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <InputLabel value="Típus" />
                                <select
                                    value={form.data.type}
                                    onChange={(e) =>
                                        form.setData('type', e.target.value as CalendarEventType)
                                    }
                                    disabled={readOnly}
                                    className={selectClass}
                                >
                                    {typeOptions.map(([v, l]) => (
                                        <option key={v} value={v}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.type} />
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
                                    disabled={readOnly}
                                    className={selectClass}
                                >
                                    <option value="">– Nincs projekt –</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.code} – {p.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.project_id} />
                            </div>
                            <div>
                                <InputLabel value="Kezdő nap *" />
                                <TextInput
                                    type="date"
                                    value={form.data.starts_on}
                                    onChange={(e) => {
                                        form.setData('starts_on', e.target.value);
                                        if (form.data.ends_on < e.target.value) {
                                            form.setData('ends_on', e.target.value);
                                        }
                                    }}
                                    disabled={readOnly}
                                />
                                <InputError message={form.errors.starts_on} />
                            </div>
                            <div>
                                <InputLabel value="Záró nap *" />
                                <TextInput
                                    type="date"
                                    value={form.data.ends_on}
                                    onChange={(e) => form.setData('ends_on', e.target.value)}
                                    disabled={readOnly}
                                />
                                <InputError message={form.errors.ends_on} />
                            </div>
                            <div>
                                <InputLabel value="Kezdés (opcionális)" />
                                <TextInput
                                    type="time"
                                    value={form.data.start_time}
                                    onChange={(e) => form.setData('start_time', e.target.value)}
                                    disabled={readOnly}
                                />
                                <InputError message={form.errors.start_time} />
                            </div>
                            <div>
                                <InputLabel value="Befejezés (opcionális)" />
                                <TextInput
                                    type="time"
                                    value={form.data.end_time}
                                    onChange={(e) => form.setData('end_time', e.target.value)}
                                    disabled={readOnly}
                                />
                                <InputError message={form.errors.end_time} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Helyszín" />
                            <TextInput
                                value={form.data.location}
                                onChange={(e) => form.setData('location', e.target.value)}
                                disabled={readOnly}
                                placeholder="pl. Szentendre, Rózsa utca 12."
                            />
                            <InputError message={form.errors.location} />
                        </div>

                        {form.data.type !== 'szemelyes' && (
                            <div>
                                <InputLabel value="Beosztott munkatársak" />
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
                                                disabled={readOnly}
                                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                                            />
                                            {u.name}
                                        </label>
                                    ))}
                                </div>
                                <InputError message={form.errors.assignees} />
                            </div>
                        )}

                        <div>
                            <InputLabel value="Megjegyzés" />
                            <textarea
                                value={form.data.note}
                                onChange={(e) => form.setData('note', e.target.value)}
                                disabled={readOnly}
                                rows={2}
                                className={selectClass}
                            />
                            <InputError message={form.errors.note} />
                        </div>

                        {readOnly ? (
                            <div className="flex items-center justify-between border-t border-line pt-4 text-xs text-ink-faint">
                                <span>
                                    {event?.creator_name && `Létrehozta: ${event.creator_name} · `}
                                    {fmtDate(event?.starts_on)}
                                </span>
                                <button type="button" className="btn-ghost" onClick={onClose}>
                                    Bezárás
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 border-t border-line pt-4">
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={form.processing || busy}
                                >
                                    {event ? 'Mentés' : 'Bejegyzés létrehozása'}
                                </button>
                                <button type="button" className="btn-ghost" onClick={onClose}>
                                    Mégse
                                </button>
                                {event && (
                                    <button
                                        type="button"
                                        onClick={destroy}
                                        disabled={busy}
                                        className="btn ml-auto inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        )}
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
