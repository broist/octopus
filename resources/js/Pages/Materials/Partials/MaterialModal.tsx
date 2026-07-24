import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { MaterialCatalogItem } from '@/types/models';

interface MaterialFormData {
    name: string;
    category: string;
    unit: string;
    sku: string;
    note: string;
    [key: string]: string;
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

export default function MaterialModal({
    material,
    categories,
    units,
    canDelete = false,
    onClose,
    onDelete,
}: {
    material: MaterialCatalogItem | null;
    categories: Record<string, string>;
    units: Record<string, string>;
    canDelete?: boolean;
    onClose: () => void;
    onDelete?: () => void;
}) {
    const form = useForm<MaterialFormData>({
        name: material?.name ?? '',
        category: material?.category ?? '',
        unit: material?.unit ?? 'db',
        sku: material?.sku ?? '',
        note: material?.note ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (material) {
            form.put(route('materials.catalog.update', material.id), options);
        } else {
            form.post(route('materials.catalog.store'), options);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {material ? 'Anyag szerkesztése' : 'Új anyag az anyagtörzsbe'}
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                placeholder="pl. Ytong falazóelem 30 cm"
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Kategória" />
                                <select
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                    className={selectClass}
                                >
                                    <option value="">— nincs megadva —</option>
                                    {Object.entries(categories).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.category} />
                            </div>
                            <div>
                                <InputLabel value="Mértékegység *" />
                                <select
                                    value={form.data.unit}
                                    onChange={(e) => form.setData('unit', e.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(units).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.unit} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Cikkszám (opcionális)" />
                            <TextInput
                                value={form.data.sku}
                                onChange={(e) => form.setData('sku', e.target.value)}
                                autoComplete="off"
                            />
                            <InputError message={form.errors.sku} />
                        </div>

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
                                {material ? 'Mentés' : 'Anyag felvétele'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                            {material && canDelete && onDelete && (
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className="btn ml-auto inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                    title="Anyag törlése"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
