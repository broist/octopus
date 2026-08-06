import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { LedgerMemberSetting, Option } from '@/types/models';

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

interface MemberFormData {
    name: string;
    user_id: string;
    default_share: string;
    is_active: boolean;
    sort_order: string;
    [key: string]: string | boolean;
}

export default function MemberModal({
    member,
    users,
    onClose,
}: {
    member: LedgerMemberSetting | null;
    users: Option[];
    onClose: () => void;
}) {
    const form = useForm<MemberFormData>({
        name: member?.name ?? '',
        user_id: member?.user_id != null ? String(member.user_id) : '',
        default_share: member != null ? String(member.default_share) : '',
        is_active: member?.is_active ?? true,
        sort_order: member != null ? String(member.sort_order) : '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({
            ...d,
            user_id: d.user_id === '' ? null : d.user_id,
            sort_order: d.sort_order === '' ? null : d.sort_order,
            is_active: d.is_active ? 1 : 0,
        }));

        const opts = { preserveScroll: true, onSuccess: onClose };
        if (member) {
            form.put(route('finance.ledger.members.update', member.id), opts);
        } else {
            form.post(route('finance.ledger.members.store'), opts);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex justify-center overflow-y-auto p-3 sm:p-4">
                <DialogPanel className="o-card m-auto w-full max-w-md p-4 sm:p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {member ? 'Tag szerkesztése' : 'Új tag'}
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Név *" />
                            <TextInput
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                placeholder="pl. Ádám"
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        <div>
                            <InputLabel value="Octopus felhasználó" />
                            <select
                                value={form.data.user_id}
                                onChange={(e) => form.setData('user_id', e.target.value)}
                                className={selectClass}
                            >
                                <option value="">— nincs összekötve —</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-ink-soft">
                                Aki össze van kötve, az látja a nyilvántartást, és harang-értesítést kap
                                minden új esedékes befizetésről.
                            </p>
                            <InputError message={form.errors.user_id} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <InputLabel value="Alapértelmezett részesedés (%) *" />
                                <TextInput
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.001"
                                    value={form.data.default_share}
                                    onChange={(e) => form.setData('default_share', e.target.value)}
                                    placeholder="pl. 30"
                                />
                                <InputError message={form.errors.default_share} />
                            </div>
                            <div>
                                <InputLabel value="Sorrend" />
                                <TextInput
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={form.data.sort_order}
                                    onChange={(e) => form.setData('sort_order', e.target.value)}
                                    placeholder="pl. 10"
                                />
                                <InputError message={form.errors.sort_order} />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={form.data.is_active}
                                onChange={(e) => form.setData('is_active', e.target.checked)}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            Aktív (új költségek felosztásában szerepel)
                        </label>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {member ? 'Mentés' : 'Hozzáadás'}
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
