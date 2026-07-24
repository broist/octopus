import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { MachineDetail, MachineListItem, Option } from '@/types/models';

interface MachineFormData {
    name: string;
    kind: string;
    identifier: string;
    manufacture_year: string;
    purchased_on: string;
    ownership: string;
    rental_source: string;
    status: string;
    location: string;
    responsible_user_id: string;
    next_service_on: string;
    inspection_valid_until: string;
    note: string;
    [key: string]: string;
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

export default function MachineModal({
    machine,
    kinds,
    statuses,
    ownership,
    responsibleOptions,
    canDelete = false,
    onClose,
    onDelete,
}: {
    machine: (MachineListItem & Partial<MachineDetail>) | null;
    kinds: Record<string, string>;
    statuses: Record<string, string>;
    ownership: Record<string, string>;
    responsibleOptions: Option[];
    canDelete?: boolean;
    onClose: () => void;
    onDelete?: () => void;
}) {
    const form = useForm<MachineFormData>({
        name: machine?.name ?? '',
        kind: machine?.kind ?? '',
        identifier: machine?.identifier ?? '',
        manufacture_year: machine?.manufacture_year != null ? String(machine.manufacture_year) : '',
        purchased_on: machine?.purchased_on ?? '',
        ownership: machine?.ownership ?? 'sajat',
        rental_source: machine?.rental_source ?? '',
        status: machine?.status ?? 'szabad',
        location: machine?.location ?? '',
        responsible_user_id: machine?.responsible_user_id != null ? String(machine.responsible_user_id) : '',
        next_service_on: machine?.next_service_on ?? '',
        inspection_valid_until: machine?.inspection_valid_until ?? '',
        note: machine?.note ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (machine) {
            form.put(route('machines.update', machine.id), options);
        } else {
            form.post(route('machines.store'), options);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-xl p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {machine ? 'Gép / eszköz szerkesztése' : 'Új gép / eszköz'}
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                placeholder="pl. JCB 3CX kotró-rakodó"
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Kategória" />
                                <select
                                    value={form.data.kind}
                                    onChange={(e) => form.setData('kind', e.target.value)}
                                    className={selectClass}
                                >
                                    <option value="">— nincs megadva —</option>
                                    {Object.entries(kinds).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.kind} />
                            </div>
                            <div>
                                <InputLabel value="Azonosító / rendszám" />
                                <TextInput
                                    value={form.data.identifier}
                                    onChange={(e) => form.setData('identifier', e.target.value)}
                                    placeholder="pl. ABC-123"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.identifier} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                                <InputLabel value="Gyártási év" />
                                <TextInput
                                    type="number"
                                    min={1950}
                                    max={new Date().getFullYear() + 1}
                                    value={form.data.manufacture_year}
                                    onChange={(e) => form.setData('manufacture_year', e.target.value)}
                                    placeholder="pl. 2018"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.manufacture_year} />
                            </div>
                            <div>
                                <InputLabel value="Beszerzés dátuma" />
                                <TextInput
                                    type="date"
                                    value={form.data.purchased_on}
                                    onChange={(e) => form.setData('purchased_on', e.target.value)}
                                />
                                <InputError message={form.errors.purchased_on} />
                            </div>
                            <div>
                                <InputLabel value="Tulajdon *" />
                                <select
                                    value={form.data.ownership}
                                    onChange={(e) => form.setData('ownership', e.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(ownership).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.ownership} />
                            </div>
                        </div>

                        {form.data.ownership === 'berelt' && (
                            <div>
                                <InputLabel value="Bérbeadó (kitől bérelt)" />
                                <TextInput
                                    value={form.data.rental_source}
                                    onChange={(e) => form.setData('rental_source', e.target.value)}
                                    placeholder="pl. XY Gépkölcsönző Kft."
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.rental_source} />
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                            <div>
                                <InputLabel value="Aktuális hely / telephely" />
                                <TextInput
                                    value={form.data.location}
                                    onChange={(e) => form.setData('location', e.target.value)}
                                    placeholder="pl. Központi telephely"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.location} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Felelős / kezelő" />
                            <select
                                value={form.data.responsible_user_id}
                                onChange={(e) => form.setData('responsible_user_id', e.target.value)}
                                className={selectClass}
                            >
                                <option value="">— nincs kijelölve —</option>
                                {responsibleOptions.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors.responsible_user_id} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Következő szerviz esedékessége" />
                                <TextInput
                                    type="date"
                                    value={form.data.next_service_on}
                                    onChange={(e) => form.setData('next_service_on', e.target.value)}
                                />
                                <InputError message={form.errors.next_service_on} />
                            </div>
                            <div>
                                <InputLabel value="Műszaki vizsga érvényessége" />
                                <TextInput
                                    type="date"
                                    value={form.data.inspection_valid_until}
                                    onChange={(e) => form.setData('inspection_valid_until', e.target.value)}
                                />
                                <InputError message={form.errors.inspection_valid_until} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Megjegyzés" />
                            <textarea
                                value={form.data.note}
                                onChange={(e) => form.setData('note', e.target.value)}
                                rows={3}
                                className={selectClass}
                            />
                            <InputError message={form.errors.note} />
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {machine ? 'Mentés' : 'Gép felvétele'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                            {machine && canDelete && onDelete && (
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className={clsx(
                                        'btn ml-auto inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10',
                                    )}
                                    title="Gép archiválása"
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
