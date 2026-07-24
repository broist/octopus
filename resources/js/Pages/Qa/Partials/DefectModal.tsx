import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { Camera, Trash2, X } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { DefectItem, Option, ProjectRef } from '@/types/models';

interface DefectFormData {
    project_id: string;
    inspection_id: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    responsible_user_id: string;
    due_on: string;
    photos: File[];
    remove_photos: number[];
    [key: string]: string | File[] | number[];
}

export interface DefectPreset {
    project_id?: number | null;
    inspection_id?: number | null;
    title?: string;
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

export default function DefectModal({
    defect,
    preset,
    projects,
    users,
    statuses,
    severities,
    onClose,
}: {
    defect: DefectItem | null;
    preset?: DefectPreset;
    projects: ProjectRef[];
    users: Option[];
    statuses: Record<string, string>;
    severities: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm<DefectFormData>({
        project_id: defect?.project?.id
            ? String(defect.project.id)
            : preset?.project_id
              ? String(preset.project_id)
              : '',
        inspection_id: defect?.inspection?.id
            ? String(defect.inspection.id)
            : preset?.inspection_id
              ? String(preset.inspection_id)
              : '',
        title: defect?.title ?? preset?.title ?? '',
        description: defect?.description ?? '',
        severity: defect?.severity ?? 'kozepes',
        status: defect?.status ?? 'nyitott',
        responsible_user_id: defect?.responsible_id != null ? String(defect.responsible_id) : '',
        due_on: defect?.due_on ?? '',
        photos: [],
        remove_photos: [],
    });

    const keptPhotos = defect?.photos.filter((p) => !form.data.remove_photos.includes(p.id)) ?? [];

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, ...(defect ? { _method: 'put' } : {}) }));
        const opts = { forceFormData: true, preserveScroll: true, onSuccess: onClose };
        if (defect) {
            form.post(route('qa.defects.update', defect.id), opts);
        } else {
            form.post(route('qa.defects.store'), opts);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-xl p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {defect ? 'Hiba szerkesztése' : 'Új hiba / hiányosság'}
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Projekt *" />
                                <select
                                    value={form.data.project_id}
                                    onChange={(e) => form.setData('project_id', e.target.value)}
                                    className={selectClass}
                                    disabled={!!preset?.project_id && !defect}
                                >
                                    <option value="">— válasszon —</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.code} – {p.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.project_id} />
                            </div>
                            <div>
                                <InputLabel value="Felelős" />
                                <select
                                    value={form.data.responsible_user_id}
                                    onChange={(e) => form.setData('responsible_user_id', e.target.value)}
                                    className={selectClass}
                                >
                                    <option value="">— nincs megadva —</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.responsible_user_id} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                placeholder="pl. Repedés a 2. emeleti falban"
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.title} />
                        </div>

                        <div>
                            <InputLabel value="Leírás" />
                            <textarea
                                value={form.data.description}
                                onChange={(e) => form.setData('description', e.target.value)}
                                rows={2}
                                className={selectClass}
                            />
                            <InputError message={form.errors.description} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                                <InputLabel value="Súlyosság *" />
                                <select
                                    value={form.data.severity}
                                    onChange={(e) => form.setData('severity', e.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(severities).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <InputLabel value="Státusz *" />
                                <select
                                    value={form.data.status}
                                    onChange={(e) => form.setData('status', e.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(statuses).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
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
                        </div>

                        {/* Fotók */}
                        <div className="space-y-2">
                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-cream/40 px-4 py-4 text-sm text-ink-soft hover:border-accent/50">
                                <Camera size={16} className="text-accent" />
                                Fotó csatolása
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    multiple
                                    onChange={(e) => {
                                        if (e.target.files?.length) {
                                            form.setData('photos', [...form.data.photos, ...Array.from(e.target.files)]);
                                        }
                                        e.target.value = '';
                                    }}
                                    className="hidden"
                                />
                            </label>

                            {keptPhotos.length > 0 && (
                                <div className="grid grid-cols-4 gap-2">
                                    {keptPhotos.map((p) => (
                                        <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg border border-line">
                                            {p.is_image ? (
                                                <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-cream text-[10px] text-ink-faint">
                                                    {p.name}
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => form.setData('remove_photos', [...form.data.remove_photos, p.id])}
                                                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-coral"
                                            >
                                                <X size={11} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {form.data.photos.length > 0 && (
                                <p className="text-xs text-ink-faint">{form.data.photos.length} új fotó feltöltésre kész.</p>
                            )}
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {defect ? 'Mentés' : 'Hiba rögzítése'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
