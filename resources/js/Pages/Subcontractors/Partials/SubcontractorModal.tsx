import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { Building2, Trash2, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { SubcontractorDetail, SubcontractorListItem } from '@/types/models';

interface SubcontractorFormData {
    name: string;
    is_company: boolean;
    trade: string;
    crew_size: string;
    availability_note: string;
    contact_name: string;
    email: string;
    phone: string;
    tax_id: string;
    address: string;
    note: string;
    [key: string]: string | boolean;
}

export default function SubcontractorModal({
    subcontractor,
    trades,
    canDelete = false,
    onClose,
    onDelete,
}: {
    subcontractor: (SubcontractorListItem & Partial<SubcontractorDetail>) | null;
    trades: Record<string, string>;
    canDelete?: boolean;
    onClose: () => void;
    onDelete?: () => void;
}) {
    const form = useForm<SubcontractorFormData>({
        name: subcontractor?.name ?? '',
        is_company: subcontractor?.is_company ?? true,
        trade: subcontractor?.trade ?? '',
        crew_size: subcontractor?.crew_size != null ? String(subcontractor.crew_size) : '',
        availability_note: subcontractor?.availability_note ?? '',
        contact_name: subcontractor?.contact_name ?? '',
        email: subcontractor?.email ?? '',
        phone: subcontractor?.phone ?? '',
        tax_id: subcontractor?.tax_id ?? '',
        address: subcontractor?.address ?? '',
        note: subcontractor?.note ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (subcontractor) {
            form.put(route('subcontractors.update', subcontractor.id), options);
        } else {
            form.post(route('subcontractors.store'), options);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-xl p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {subcontractor ? 'Alvállalkozó szerkesztése' : 'Új alvállalkozó'}
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        {/* Cég / magánszemély */}
                        <div className="flex rounded-lg border border-line bg-cream/50 p-1">
                            {[
                                { value: true, label: 'Cég', icon: Building2 },
                                { value: false, label: 'Magánszemély', icon: UserIcon },
                            ].map((opt) => (
                                <button
                                    key={String(opt.value)}
                                    type="button"
                                    onClick={() => form.setData('is_company', opt.value)}
                                    className={clsx(
                                        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
                                        form.data.is_company === opt.value
                                            ? 'bg-accent text-white'
                                            : 'text-ink-soft hover:text-ink',
                                    )}
                                >
                                    <opt.icon size={15} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <div>
                            <InputLabel value={form.data.is_company ? 'Cégnév *' : 'Név *'} />
                            <TextInput
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Szakma / szakterület" />
                                <select
                                    value={form.data.trade}
                                    onChange={(e) => form.setData('trade', e.target.value)}
                                    className="block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                                >
                                    <option value="">— nincs megadva —</option>
                                    {Object.entries(trades).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.trade} />
                            </div>
                            <div>
                                <InputLabel value="Létszám (fő)" />
                                <TextInput
                                    type="number"
                                    min={1}
                                    value={form.data.crew_size}
                                    onChange={(e) => form.setData('crew_size', e.target.value)}
                                    placeholder="pl. 4"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.crew_size} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Elérhetőség / kapacitás megjegyzés" />
                            <textarea
                                value={form.data.availability_note}
                                onChange={(e) => form.setData('availability_note', e.target.value)}
                                rows={2}
                                placeholder="Mikor ráérnek, jelenleg hol vannak lekötve…"
                                className="block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                            />
                            <InputError message={form.errors.availability_note} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Kapcsolattartó" />
                                <TextInput
                                    value={form.data.contact_name}
                                    onChange={(e) => form.setData('contact_name', e.target.value)}
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.contact_name} />
                            </div>
                            <div>
                                <InputLabel value="Adószám" />
                                <TextInput
                                    value={form.data.tax_id}
                                    onChange={(e) => form.setData('tax_id', e.target.value)}
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.tax_id} />
                            </div>
                            <div>
                                <InputLabel value="E-mail cím" />
                                <TextInput
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.email} />
                            </div>
                            <div>
                                <InputLabel value="Telefonszám" />
                                <TextInput
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    placeholder="+36 …"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.phone} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Székhely / cím" />
                            <TextInput
                                value={form.data.address}
                                onChange={(e) => form.setData('address', e.target.value)}
                                placeholder="Irányítószám, város, utca, házszám"
                                autoComplete="off"
                            />
                            <InputError message={form.errors.address} />
                        </div>

                        <div>
                            <InputLabel value="Megjegyzés" />
                            <textarea
                                value={form.data.note}
                                onChange={(e) => form.setData('note', e.target.value)}
                                rows={3}
                                className="block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                            />
                            <InputError message={form.errors.note} />
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {subcontractor ? 'Mentés' : 'Alvállalkozó felvétele'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                            {subcontractor && canDelete && onDelete && (
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className="btn ml-auto inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                    title="Alvállalkozó archiválása"
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
