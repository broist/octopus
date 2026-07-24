import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { ProjectRef, SafetyRecordItem } from '@/types/models';

interface SafetyFormData {
    project_id: string;
    type: string;
    occurred_on: string;
    title: string;
    description: string;
    participants: string;
    [key: string]: string;
}

const selectClass = 'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SafetyModal({
    record,
    types,
    projects,
    onClose,
}: {
    record: SafetyRecordItem | null;
    types: Record<string, string>;
    projects: ProjectRef[];
    onClose: () => void;
}) {
    const form = useForm<SafetyFormData>({
        project_id: record?.project?.id != null ? String(record.project.id) : '',
        type: record?.type ?? 'oktatas',
        occurred_on: record?.occurred_on ?? today(),
        title: record?.title ?? '',
        description: record?.description ?? '',
        participants: record?.participants ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (record) {
            form.put(route('qa.safety.update', record.id), opts);
        } else {
            form.post(route('qa.safety.store'), opts);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {record ? 'Bejegyzés szerkesztése' : 'Új munkavédelmi bejegyzés'}
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Típus *" />
                                <select value={form.data.type} onChange={(e) => form.setData('type', e.target.value)} className={selectClass}>
                                    {Object.entries(types).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <InputLabel value="Dátum *" />
                                <TextInput type="date" value={form.data.occurred_on} onChange={(e) => form.setData('occurred_on', e.target.value)} />
                                <InputError message={form.errors.occurred_on} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="pl. Munkavédelmi oktatás – új belépők" isFocused autoComplete="off" />
                            <InputError message={form.errors.title} />
                        </div>

                        <div>
                            <InputLabel value="Projekt (opcionális)" />
                            <select value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)} className={selectClass}>
                                <option value="">— nincs / általános —</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <InputLabel value="Résztvevők" />
                            <textarea value={form.data.participants} onChange={(e) => form.setData('participants', e.target.value)} rows={2} placeholder="Kik vettek részt" className={selectClass} />
                        </div>

                        <div>
                            <InputLabel value="Leírás / jegyzőkönyv" />
                            <textarea value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} rows={3} className={selectClass} />
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {record ? 'Mentés' : 'Rögzítés'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>Mégse</button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
