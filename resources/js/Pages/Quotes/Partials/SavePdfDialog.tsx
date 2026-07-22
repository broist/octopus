import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { FolderOpen, Save } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { FolderOption, PdfMode, QuoteData } from '@/types/quote';

interface Props {
    quoteId: number;
    data: QuoteData;
    folders: FolderOption[];
    defaultMode: PdfMode;
    onClose: () => void;
}

const selCls =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

export default function SavePdfDialog({ quoteId, data, folders, defaultMode, onClose }: Props) {
    const suggested =
        [data.quoteNumber, data.projectName].filter(Boolean).join(' - ') || 'AcuWall árajánlat';

    const form = useForm<{
        title: string;
        folder_id: string;
        mode: PdfMode;
    }>({
        title: suggested,
        folder_id: '',
        mode: defaultMode,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform(
            (d) =>
                ({
                    ...d,
                    folder_id: d.folder_id === '' ? null : Number(d.folder_id),
                    data,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any,
        );
        form.post(route('ajanlatok.pdf', quoteId), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-md p-6">
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-sidebar">
                        <FolderOpen size={18} className="text-accent" />
                        PDF mentése a Fájlkezelőbe
                    </DialogTitle>
                    <p className="mt-1 text-sm text-ink-soft">
                        Az ügyfél-PDF a választott mappába kerül, verziózható dokumentumként.
                    </p>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Fájlnév" />
                            <TextInput
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                isFocused
                            />
                            <InputError message={form.errors.title} />
                        </div>

                        <div>
                            <InputLabel value="Cél mappa" />
                            <select
                                className={selCls}
                                value={form.data.folder_id}
                                onChange={(e) => form.setData('folder_id', e.target.value)}
                            >
                                <option value="">📁 Fájlok (gyökér)</option>
                                {folders.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {' '.repeat(f.depth * 3)}
                                        {f.depth > 0 ? '└ ' : ''}
                                        {f.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors.folder_id} />
                        </div>

                        <div>
                            <InputLabel value="Tartalom" />
                            <select
                                className={selCls}
                                value={form.data.mode}
                                onChange={(e) => form.setData('mode', e.target.value as PdfMode)}
                            >
                                <option value="summary">Összesített – munkanemenként</option>
                                <option value="detailed">Részletes – tételes bontással</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                <Save size={16} />
                                Mentés a Fájlkezelőbe
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
