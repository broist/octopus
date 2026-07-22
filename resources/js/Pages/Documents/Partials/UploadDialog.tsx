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
    names: string[];
    folder_id: number | null;
    category: string;
    project_id: number | '';
    [key: string]: File[] | string[] | number | string | null;
}

/** Fájlnév kiterjesztés nélkül (átnevezés alapértéke). */
function baseName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

function extOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot) : '';
}

/**
 * Feltöltés megerősítő: a kiválasztott/fotózott fájlok listája, fájlonként
 * átnevezhető névvel, opcionális kategória- és projekt-kötéssel.
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
        names: [],
        folder_id: folderId,
        category: '',
        project_id: '',
    });

    useEffect(() => {
        if (open) {
            form.setData((prev) => ({
                ...prev,
                files,
                names: files.map((f) => baseName(f.name)),
                folder_id: folderId,
                category: '',
                project_id: '',
            }));
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, files, folderId]);

    const removeFile = (index: number) => {
        form.setData((prev) => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== index),
            names: prev.names.filter((_, i) => i !== index),
        }));
    };

    const renameFile = (index: number, value: string) => {
        form.setData(
            'names',
            form.data.names.map((n, i) => (i === index ? value : n)),
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
                <DialogPanel className="o-card w-full max-w-lg p-6">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-sidebar">
                        <FileUp size={17} />
                        Feltöltés ({form.data.files.length} fájl)
                    </DialogTitle>
                    <p className="mt-1 text-xs text-ink-faint">
                        A név átírható – a fájl ezzel a névvel jelenik meg és tölthető le. A
                        kiterjesztés változatlan marad.
                    </p>

                    <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-line bg-cream/40 p-2">
                        {form.data.files.map((f, i) => (
                            <div
                                key={`${f.name}-${i}`}
                                className="flex items-center gap-2 rounded bg-white px-2.5 py-1.5"
                            >
                                <div className="flex min-w-0 flex-1 items-center">
                                    <input
                                        value={form.data.names[i] ?? ''}
                                        onChange={(e) => renameFile(i, e.target.value)}
                                        placeholder="Fájlnév"
                                        className="min-w-0 flex-1 rounded-l-md border-line bg-white py-1 text-sm focus:border-accent focus:ring-accent/30"
                                    />
                                    <span className="rounded-r-md border border-l-0 border-line bg-cream px-2 py-1 text-xs text-ink-faint">
                                        {extOf(f.name) || '—'}
                                    </span>
                                </div>
                                <span className="shrink-0 text-xs text-ink-faint">
                                    {fmtBytes(f.size)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeFile(i)}
                                    className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-cream hover:text-coral"
                                    title="Eltávolítás a feltöltésből"
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
