import { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { FileUp, X } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import InputError from '@/Components/ui/InputError';
import { fmtBytes } from '@/lib/format';
import type { ProjectOption } from '@/types/models';

interface UploadDialogProps {
    open: boolean;
    files: File[];
    folderId: number | null;
    categories: Record<string, string>;
    projects: ProjectOption[];
    onClose: () => void;
}

interface UploadFormData {
    files: File[];
    folder_id: number | null;
    category: string;
    project_id: number | '';
    [key: string]: File[] | number | string | null;
}

/**
 * Feltöltés megerősítő: a kiválasztott/fotózott fájlok listája + opcionális
 * kategória és projekt-kötés, folyamatjelzővel.
 */
export default function UploadDialog({
    open,
    files,
    folderId,
    categories,
    projects,
    onClose,
}: UploadDialogProps) {
    const form = useForm<UploadFormData>({
        files: [],
        folder_id: folderId,
        category: '',
        project_id: '',
    });

    useEffect(() => {
        if (open) {
            form.setData((prev) => ({
                ...prev,
                files,
                folder_id: folderId,
                category: '',
                project_id: '',
            }));
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, files, folderId]);

    const removeFile = (index: number) => {
        form.setData(
            'files',
            form.data.files.filter((_, i) => i !== index),
        );
    };

    const submit = () => {
        form.post(route('documents.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    const fileError = Object.entries(form.errors).find(([k]) => k.startsWith('files'))?.[1];

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="o-card w-full max-w-md p-6">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-sidebar">
                        <FileUp size={17} />
                        Feltöltés ({form.data.files.length} fájl)
                    </DialogTitle>

                    <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-md border border-line bg-cream/40 p-2">
                        {form.data.files.map((f, i) => (
                            <div
                                key={`${f.name}-${i}`}
                                className="flex items-center gap-2 rounded bg-white px-2.5 py-1.5 text-sm"
                            >
                                <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                                <span className="shrink-0 text-xs text-ink-faint">
                                    {fmtBytes(f.size)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeFile(i)}
                                    className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-cream hover:text-coral"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        {form.data.files.length === 0 && (
                            <p className="px-2 py-3 text-center text-xs text-ink-faint">
                                Nincs kiválasztott fájl.
                            </p>
                        )}
                    </div>
                    <InputError message={fileError} />

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                            <InputLabel value="Kategória" />
                            <select
                                value={form.data.category}
                                onChange={(e) => form.setData('category', e.target.value)}
                                className="block w-full rounded-md border-line bg-white text-sm focus:border-accent focus:ring-accent/30"
                            >
                                <option value="">Automatikus</option>
                                {Object.entries(categories).map(([v, l]) => (
                                    <option key={v} value={v}>
                                        {l}
                                    </option>
                                ))}
                            </select>
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
                                className="block w-full rounded-md border-line bg-white text-sm focus:border-accent focus:ring-accent/30"
                            >
                                <option value="">– Nincs –</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {form.progress && (
                        <div className="mt-4">
                            <div className="h-2 overflow-hidden rounded-sm bg-line">
                                <div
                                    className="h-full bg-accent transition-all"
                                    style={{ width: `${form.progress.percentage ?? 0}%` }}
                                />
                            </div>
                            <p className="mt-1 text-xs text-ink-faint">
                                Feltöltés… {form.progress.percentage ?? 0}%
                            </p>
                        </div>
                    )}

                    <div className="mt-5 flex gap-2">
                        <button
                            className="btn-primary"
                            onClick={submit}
                            disabled={form.processing || form.data.files.length === 0}
                        >
                            Feltöltés
                        </button>
                        <button className="btn-ghost" onClick={onClose}>
                            Mégse
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
