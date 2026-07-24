import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { ProjectRef, QaTemplateOption } from '@/types/models';

interface StartFormData {
    project_id: string;
    checklist_template_id: string;
    title: string;
    purpose: string;
    inspected_on: string;
    note: string;
    [key: string]: string;
}

const selectClass = 'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function InspectionStartModal({
    projects,
    templates,
    purposes,
    onClose,
}: {
    projects: ProjectRef[];
    templates: QaTemplateOption[];
    purposes: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm<StartFormData>({
        project_id: '',
        checklist_template_id: '',
        title: '',
        purpose: 'minoseg',
        inspected_on: today(),
        note: '',
    });

    const pickTemplate = (id: string) => {
        const tpl = templates.find((t) => String(t.id) === id);
        form.setData((data) => ({
            ...data,
            checklist_template_id: id,
            title: tpl && !data.title ? tpl.name : data.title,
            purpose: tpl ? tpl.purpose : data.purpose,
        }));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('qa.inspections.store'), { onSuccess: onClose });
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">Új ellenőrzés</DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Projekt *" />
                            <select value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)} className={selectClass}>
                                <option value="">— válasszon —</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                                ))}
                            </select>
                            <InputError message={form.errors.project_id} />
                        </div>

                        <div>
                            <InputLabel value="Sablon (opcionális — a pontok bemásolódnak)" />
                            <select value={form.data.checklist_template_id} onChange={(e) => pickTemplate(e.target.value)} className={selectClass}>
                                <option value="">— sablon nélkül —</option>
                                {templates.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.items_count} pont)</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Megnevezés *" />
                                <TextInput value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="pl. Átadás előtti bejárás" autoComplete="off" />
                                <InputError message={form.errors.title} />
                            </div>
                            <div>
                                <InputLabel value="Cél *" />
                                <select value={form.data.purpose} onChange={(e) => form.setData('purpose', e.target.value)} className={selectClass}>
                                    {Object.entries(purposes).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Dátum *" />
                            <TextInput type="date" value={form.data.inspected_on} onChange={(e) => form.setData('inspected_on', e.target.value)} />
                            <InputError message={form.errors.inspected_on} />
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>Létrehozás és kitöltés</button>
                            <button type="button" className="btn-ghost" onClick={onClose}>Mégse</button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
