import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { MaterialOption, Option, ProcurementItem, ProjectRef } from '@/types/models';

interface ProcurementFormData {
    project_id: string;
    material_id: string;
    supplier_id: string;
    status: string;
    quantity: string;
    unit_price: string;
    ordered_on: string;
    expected_on: string;
    received_on: string;
    received_quantity: string;
    note: string;
    [key: string]: string;
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

export default function ProcurementModal({
    procurement,
    materials,
    suppliers,
    projects,
    statuses,
    presetProjectId,
    canDelete = false,
    onClose,
    onDelete,
}: {
    procurement: ProcurementItem | null;
    materials: MaterialOption[];
    suppliers: Option[];
    projects: ProjectRef[];
    statuses: Record<string, string>;
    presetProjectId?: number | null;
    canDelete?: boolean;
    onClose: () => void;
    onDelete?: () => void;
}) {
    const form = useForm<ProcurementFormData>({
        project_id: procurement?.project?.id
            ? String(procurement.project.id)
            : presetProjectId
              ? String(presetProjectId)
              : '',
        material_id: procurement?.material?.id ? String(procurement.material.id) : '',
        supplier_id: procurement?.supplier_id != null ? String(procurement.supplier_id) : '',
        status: procurement?.status ?? 'tervezett',
        quantity: procurement?.quantity != null ? String(procurement.quantity) : '',
        unit_price: procurement?.unit_price != null ? String(procurement.unit_price) : '',
        ordered_on: procurement?.ordered_on ?? '',
        expected_on: procurement?.expected_on ?? '',
        received_on: procurement?.received_on ?? '',
        received_quantity: procurement?.received_quantity != null ? String(procurement.received_quantity) : '',
        note: procurement?.note ?? '',
    });

    const selectedMaterial = materials.find((m) => String(m.id) === form.data.material_id);
    const unitLabel = selectedMaterial?.unit_label ?? '';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (procurement) {
            form.put(route('materials.update', procurement.id), options);
        } else {
            form.post(route('materials.store'), options);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-xl p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {procurement ? 'Beszerzés szerkesztése' : 'Új beszerzés'}
                    </DialogTitle>

                    {materials.length === 0 ? (
                        <p className="mt-4 text-sm text-ink-soft">
                            Előbb vegyen fel legalább egy anyagot az{' '}
                            <span className="font-medium">Anyagtörzs</span> nézetben.
                        </p>
                    ) : (
                        <form onSubmit={submit} className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <InputLabel value="Projekt *" />
                                    <select
                                        value={form.data.project_id}
                                        onChange={(e) => form.setData('project_id', e.target.value)}
                                        className={selectClass}
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
                                    <InputLabel value="Anyag *" />
                                    <select
                                        value={form.data.material_id}
                                        onChange={(e) => form.setData('material_id', e.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="">— válasszon —</option>
                                        {materials.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.unit_label})
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={form.errors.material_id} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                    <InputLabel value={`Mennyiség * ${unitLabel ? `(${unitLabel})` : ''}`} />
                                    <TextInput
                                        type="number"
                                        min={0}
                                        step="0.001"
                                        value={form.data.quantity}
                                        onChange={(e) => form.setData('quantity', e.target.value)}
                                        isFocused
                                        autoComplete="off"
                                    />
                                    <InputError message={form.errors.quantity} />
                                </div>
                                <div>
                                    <InputLabel value="Egységár (Ft)" />
                                    <TextInput
                                        type="number"
                                        min={0}
                                        step="1"
                                        value={form.data.unit_price}
                                        onChange={(e) => form.setData('unit_price', e.target.value)}
                                        placeholder="pl. 2500"
                                        autoComplete="off"
                                    />
                                    <InputError message={form.errors.unit_price} />
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
                                    <InputError message={form.errors.status} />
                                </div>
                            </div>

                            <div>
                                <InputLabel value="Beszállító (CRM)" />
                                <select
                                    value={form.data.supplier_id}
                                    onChange={(e) => form.setData('supplier_id', e.target.value)}
                                    className={selectClass}
                                >
                                    <option value="">— nincs megadva —</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.supplier_id} />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <InputLabel value="Megrendelés dátuma" />
                                    <TextInput
                                        type="date"
                                        value={form.data.ordered_on}
                                        onChange={(e) => form.setData('ordered_on', e.target.value)}
                                    />
                                    <InputError message={form.errors.ordered_on} />
                                </div>
                                <div>
                                    <InputLabel value="Várható beérkezés" />
                                    <TextInput
                                        type="date"
                                        value={form.data.expected_on}
                                        onChange={(e) => form.setData('expected_on', e.target.value)}
                                    />
                                    <InputError message={form.errors.expected_on} />
                                </div>
                            </div>

                            {form.data.status === 'beerkezett' && (
                                <div className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-cream/40 p-3 sm:grid-cols-2">
                                    <div>
                                        <InputLabel value="Beérkezés dátuma" />
                                        <TextInput
                                            type="date"
                                            value={form.data.received_on}
                                            onChange={(e) => form.setData('received_on', e.target.value)}
                                        />
                                        <InputError message={form.errors.received_on} />
                                    </div>
                                    <div>
                                        <InputLabel value={`Beérkezett mennyiség ${unitLabel ? `(${unitLabel})` : ''}`} />
                                        <TextInput
                                            type="number"
                                            min={0}
                                            step="0.001"
                                            value={form.data.received_quantity}
                                            onChange={(e) => form.setData('received_quantity', e.target.value)}
                                            placeholder="alapból a rendelt mennyiség"
                                            autoComplete="off"
                                        />
                                        <InputError message={form.errors.received_quantity} />
                                    </div>
                                </div>
                            )}

                            <div>
                                <InputLabel value="Megjegyzés" />
                                <textarea
                                    value={form.data.note}
                                    onChange={(e) => form.setData('note', e.target.value)}
                                    rows={2}
                                    className={selectClass}
                                />
                                <InputError message={form.errors.note} />
                            </div>

                            <div className="flex items-center gap-2 border-t border-line pt-4">
                                <button type="submit" className="btn-primary" disabled={form.processing}>
                                    {procurement ? 'Mentés' : 'Beszerzés rögzítése'}
                                </button>
                                <button type="button" className="btn-ghost" onClick={onClose}>
                                    Mégse
                                </button>
                                {procurement && canDelete && onDelete && (
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        className="btn ml-auto inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                        title="Beszerzés törlése"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </DialogPanel>
            </div>
        </Dialog>
    );
}
