import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';

interface QualFormData {
    type: string;
    name: string;
    issuer: string;
    valid_from: string;
    valid_until: string;
    note: string;
    file: File | null;
    [key: string]: string | File | null;
}

export default function QualificationModal({
    userId,
    types,
    onClose,
}: {
    userId: number;
    types: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm<QualFormData>({
        type: 'vegzettseg',
        name: '',
        issuer: '',
        valid_from: '',
        valid_until: '',
        note: '',
        file: null,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('staff.qualifications.store', userId), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: onClose,
        });
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        Végzettség / jogosultság felvétele
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Típus *" />
                                <select
                                    value={form.data.type}
                                    onChange={(e) => form.setData('type', e.target.value)}
                                    className="block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                                >
                                    {Object.entries(types).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.type} />
                            </div>
                            <div>
                                <InputLabel value="Kiállító" />
                                <TextInput
                                    value={form.data.issuer}
                                    onChange={(e) => form.setData('issuer', e.target.value)}
                                    placeholder="pl. iskola, kamara, oktató…"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.issuer} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                placeholder="pl. Emelőgép-kezelői jogosítvány"
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Érvényesség kezdete" />
                                <TextInput
                                    type="date"
                                    value={form.data.valid_from}
                                    onChange={(e) => form.setData('valid_from', e.target.value)}
                                />
                                <InputError message={form.errors.valid_from} />
                            </div>
                            <div>
                                <InputLabel value="Lejárat" />
                                <TextInput
                                    type="date"
                                    value={form.data.valid_until}
                                    onChange={(e) => form.setData('valid_until', e.target.value)}
                                />
                                <InputError message={form.errors.valid_until} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Fájl (opcionális)" />
                            <input
                                type="file"
                                onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-accent-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-700 hover:file:bg-accent-100"
                            />
                            <InputError message={form.errors.file} />
                        </div>

                        <div>
                            <InputLabel value="Megjegyzés" />
                            <textarea
                                value={form.data.note}
                                onChange={(e) => form.setData('note', e.target.value)}
                                rows={2}
                                className="block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                            />
                            <InputError message={form.errors.note} />
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                Rögzítés
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
