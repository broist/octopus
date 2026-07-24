import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';

interface MaintenanceFormData {
    type: string;
    performed_on: string;
    description: string;
    cost: string;
    file: File | null;
    next_service_on: string;
    inspection_valid_until: string;
    [key: string]: string | File | null;
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MaintenanceModal({
    machineId,
    maintenanceTypes,
    onClose,
}: {
    machineId: number;
    maintenanceTypes: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm<MaintenanceFormData>({
        type: 'szerviz',
        performed_on: today(),
        description: '',
        cost: '',
        file: null,
        next_service_on: '',
        inspection_valid_until: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('machines.maintenances.store', machineId), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: onClose,
        });
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        Karbantartási bejegyzés
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Típus *" />
                                <select
                                    value={form.data.type}
                                    onChange={(e) => form.setData('type', e.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(maintenanceTypes).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.type} />
                            </div>
                            <div>
                                <InputLabel value="Dátum *" />
                                <TextInput
                                    type="date"
                                    value={form.data.performed_on}
                                    onChange={(e) => form.setData('performed_on', e.target.value)}
                                />
                                <InputError message={form.errors.performed_on} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Mi történt? *" />
                            <textarea
                                value={form.data.description}
                                onChange={(e) => form.setData('description', e.target.value)}
                                rows={2}
                                placeholder="pl. Olajcsere, fékbetét csere, éves szerviz…"
                                className={selectClass}
                            />
                            <InputError message={form.errors.description} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Költség (Ft, opcionális)" />
                                <TextInput
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={form.data.cost}
                                    onChange={(e) => form.setData('cost', e.target.value)}
                                    placeholder="pl. 85000"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.cost} />
                            </div>
                            <div>
                                <InputLabel value="Szervizlap / számla (opcionális)" />
                                <input
                                    type="file"
                                    onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)}
                                    className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-accent-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-700 hover:file:bg-accent-100"
                                />
                                <InputError message={form.errors.file} />
                            </div>
                        </div>

                        <div className="rounded-lg border border-line bg-cream/40 p-3">
                            <p className="mb-2 text-xs text-ink-soft">
                                Frissíti a gép esedékességeit? (opcionális)
                            </p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <InputLabel value="Új szerviz esedékessége" />
                                    <TextInput
                                        type="date"
                                        value={form.data.next_service_on}
                                        onChange={(e) => form.setData('next_service_on', e.target.value)}
                                    />
                                    <InputError message={form.errors.next_service_on} />
                                </div>
                                <div>
                                    <InputLabel value="Új vizsga érvényessége" />
                                    <TextInput
                                        type="date"
                                        value={form.data.inspection_valid_until}
                                        onChange={(e) =>
                                            form.setData('inspection_valid_until', e.target.value)
                                        }
                                    />
                                    <InputError message={form.errors.inspection_valid_until} />
                                </div>
                            </div>
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
