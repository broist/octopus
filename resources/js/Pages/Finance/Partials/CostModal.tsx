import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { CostItem, Option } from '@/types/models';

interface CostFormData {
    category: string;
    partner_id: string;
    description: string;
    amount: string;
    incurred_on: string;
    is_invoice: boolean;
    due_on: string;
    is_paid: boolean;
    file: File | null;
    [key: string]: string | boolean | File | null;
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CostModal({
    cost,
    projectId,
    partners,
    costCategories,
    onClose,
}: {
    cost: CostItem | null;
    projectId: number;
    partners: Option[];
    costCategories: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm<CostFormData>({
        category: cost?.category ?? 'alvallalkozo',
        partner_id: cost?.partner_id != null ? String(cost.partner_id) : '',
        description: cost?.description ?? '',
        amount: cost?.amount != null ? String(cost.amount) : '',
        incurred_on: cost?.incurred_on ?? today(),
        is_invoice: cost?.is_invoice ?? false,
        due_on: cost?.due_on ?? '',
        is_paid: cost?.is_paid ?? false,
        file: null,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { preserveScroll: true, forceFormData: true, onSuccess: onClose };
        // A bool mezőket 1/0-ként küldjük (a Laravel boolean szabály a "true"/"false"
        // stringet elutasítaná); szerkesztésnél method spoofing a multipart PUT-hoz.
        form.transform((d) => ({
            ...d,
            is_invoice: d.is_invoice ? 1 : 0,
            is_paid: d.is_paid ? 1 : 0,
            ...(cost ? { _method: 'put' } : {}),
        }));
        if (cost) {
            form.post(route('finance.costs.update', cost.id), opts);
        } else {
            form.post(route('finance.costs.store', projectId), opts);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {cost ? 'Költség szerkesztése' : 'Új költség / bejövő számla'}
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Kategória *" />
                                <select
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(costCategories).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.category} />
                            </div>
                            <div>
                                <InputLabel value="Partner (alvállalkozó / beszállító)" />
                                <select
                                    value={form.data.partner_id}
                                    onChange={(e) => form.setData('partner_id', e.target.value)}
                                    className={selectClass}
                                >
                                    <option value="">— nincs megadva —</option>
                                    {partners.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.partner_id} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput
                                value={form.data.description}
                                onChange={(e) => form.setData('description', e.target.value)}
                                placeholder="pl. Villanyszerelés 2. részteljesítés"
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.description} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Nettó összeg (Ft) *" />
                                <TextInput
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={form.data.amount}
                                    onChange={(e) => form.setData('amount', e.target.value)}
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.amount} />
                            </div>
                            <div>
                                <InputLabel value="Teljesítés dátuma *" />
                                <TextInput
                                    type="date"
                                    value={form.data.incurred_on}
                                    onChange={(e) => form.setData('incurred_on', e.target.value)}
                                />
                                <InputError message={form.errors.incurred_on} />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={form.data.is_invoice}
                                onChange={(e) => form.setData('is_invoice', e.target.checked)}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            Bejövő számla (határidővel, kifizetettséggel, csatolt fájllal)
                        </label>

                        {form.data.is_invoice && (
                            <div className="space-y-3 rounded-lg border border-line bg-cream/40 p-3">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <InputLabel value="Fizetési határidő" />
                                        <TextInput
                                            type="date"
                                            value={form.data.due_on}
                                            onChange={(e) => form.setData('due_on', e.target.value)}
                                        />
                                        <InputError message={form.errors.due_on} />
                                    </div>
                                    <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                                        <input
                                            type="checkbox"
                                            checked={form.data.is_paid}
                                            onChange={(e) => form.setData('is_paid', e.target.checked)}
                                            className="rounded-sm border-line text-accent focus:ring-accent/40"
                                        />
                                        Kifizetve
                                    </label>
                                </div>
                                <div>
                                    <InputLabel value={`Számla fájl (PDF/fotó)${cost?.has_file ? ' — új feltöltés felülírja' : ''}`} />
                                    <input
                                        type="file"
                                        onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)}
                                        className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-accent-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-700 hover:file:bg-accent-100"
                                    />
                                    <InputError message={form.errors.file} />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {cost ? 'Mentés' : 'Rögzítés'}
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
