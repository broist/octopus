import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { Building2, Trash2, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { PartnerDetail, PartnerListItem } from '@/types/models';

interface PartnerFormData {
    name: string;
    is_company: boolean;
    is_client: boolean;
    is_supplier: boolean;
    is_subcontractor: boolean;
    contact_name: string;
    email: string;
    phone: string;
    tax_id: string;
    address: string;
    note: string;
    [key: string]: string | boolean;
}

type RoleKey = 'is_client' | 'is_supplier' | 'is_subcontractor';

export default function PartnerModal({
    partner,
    roles,
    canDelete = false,
    onClose,
    onDelete,
}: {
    partner: (PartnerListItem & Partial<PartnerDetail>) | null;
    roles: Record<string, string>;
    canDelete?: boolean;
    onClose: () => void;
    onDelete?: () => void;
}) {
    const form = useForm<PartnerFormData>({
        name: partner?.name ?? '',
        is_company: partner?.is_company ?? true,
        is_client: partner?.is_client ?? true,
        is_supplier: partner?.is_supplier ?? false,
        is_subcontractor: partner?.is_subcontractor ?? false,
        contact_name: partner?.contact_name ?? '',
        email: partner?.email ?? '',
        phone: partner?.phone ?? '',
        tax_id: partner?.tax_id ?? '',
        address: partner?.address ?? '',
        note: partner?.note ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (partner) {
            form.put(route('crm.update', partner.id), options);
        } else {
            form.post(route('crm.store'), options);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-xl p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {partner ? 'Partner szerkesztése' : 'Új partner'}
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

                        {/* Szerepek */}
                        <div>
                            <InputLabel value="Szerep(ek)" />
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
                                {(Object.entries(roles) as [RoleKey, string][]).map(
                                    ([flag, label]) => (
                                        <label
                                            key={flag}
                                            className="flex items-center gap-1.5 text-sm text-ink-soft"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={Boolean(form.data[flag])}
                                                onChange={(e) =>
                                                    form.setData(flag, e.target.checked)
                                                }
                                                className="rounded border-line text-accent focus:ring-accent/40"
                                            />
                                            {label}
                                        </label>
                                    ),
                                )}
                            </div>
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
                            <InputLabel value="Cím" />
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
                                {partner ? 'Mentés' : 'Partner felvétele'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                            {partner && canDelete && onDelete && (
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className="btn ml-auto inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                    title="Partner archiválása"
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
