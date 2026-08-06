import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { today } from '@/Pages/Finance/Partials/ledger';
import type { LedgerCost, LedgerMember } from '@/types/models';

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

interface PaymentFormData {
    company_member_id: string;
    shared_cost_id: string;
    paid_on: string;
    currency: string;
    amount: string;
    exchange_rate: string;
    note: string;
    [key: string]: string;
}

/**
 * Tagi kölcsön befizetés rögzítése: ki, mikor, mennyit utalt a céges számlára.
 * A „Melyik költséghez” mező opcionális — ha üres, általános befizetés, ami
 * ugyanúgy javítja az illető egyenlegét.
 */
export default function PaymentModal({
    members,
    costs,
    currencies,
    preset,
    onClose,
}: {
    members: LedgerMember[];
    costs: LedgerCost[];
    currencies: Record<string, string>;
    preset?: { member_id?: number; cost_id?: number } | null;
    onClose: () => void;
}) {
    const form = useForm<PaymentFormData>({
        company_member_id: preset?.member_id ? String(preset.member_id) : String(members[0]?.id ?? ''),
        shared_cost_id: preset?.cost_id ? String(preset.cost_id) : '',
        paid_on: today(),
        currency: 'HUF',
        amount: '',
        exchange_rate: '',
        note: '',
    });

    const isForeign = form.data.currency !== 'HUF';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({
            ...d,
            shared_cost_id: d.shared_cost_id === '' ? null : d.shared_cost_id,
            exchange_rate: d.exchange_rate === '' ? null : d.exchange_rate,
        }));
        form.post(route('finance.ledger.payments.store'), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex justify-center overflow-y-auto p-3 sm:p-4">
                <DialogPanel className="o-card m-auto w-full max-w-lg p-4 sm:p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        Tagi kölcsön befizetés
                    </DialogTitle>
                    <p className="mt-1 text-sm text-ink-soft">
                        Ide az kerül, amit valaki ténylegesen átutalt a céges bankszámlára.
                    </p>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Ki fizetett be *" />
                                <select
                                    value={form.data.company_member_id}
                                    onChange={(e) => form.setData('company_member_id', e.target.value)}
                                    className={selectClass}
                                >
                                    {members.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.company_member_id} />
                            </div>
                            <div>
                                <InputLabel value="Befizetés dátuma *" />
                                <TextInput
                                    type="date"
                                    value={form.data.paid_on}
                                    onChange={(e) => form.setData('paid_on', e.target.value)}
                                />
                                <InputError message={form.errors.paid_on} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                                <InputLabel value="Pénznem *" />
                                <select
                                    value={form.data.currency}
                                    onChange={(e) => form.setData('currency', e.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(currencies).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <InputLabel value="Összeg *" />
                                <TextInput
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.data.amount}
                                    onChange={(e) => form.setData('amount', e.target.value)}
                                    isFocused
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.amount} />
                            </div>
                            <div>
                                <InputLabel value={isForeign ? 'Árfolyam *' : 'Árfolyam'} />
                                <TextInput
                                    type="number"
                                    min={0}
                                    step="0.0001"
                                    value={isForeign ? form.data.exchange_rate : ''}
                                    disabled={!isForeign}
                                    placeholder={isForeign ? 'pl. 395' : '—'}
                                    onChange={(e) => form.setData('exchange_rate', e.target.value)}
                                />
                                <InputError message={form.errors.exchange_rate} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Melyik költséghez (nem kötelező)" />
                            <select
                                value={form.data.shared_cost_id}
                                onChange={(e) => form.setData('shared_cost_id', e.target.value)}
                                className={selectClass}
                            >
                                <option value="">— általános tagi kölcsön —</option>
                                {costs.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.title}
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors.shared_cost_id} />
                        </div>

                        <div>
                            <InputLabel value="Megjegyzés" />
                            <TextInput
                                value={form.data.note}
                                onChange={(e) => form.setData('note', e.target.value)}
                                placeholder="pl. banki utalás közleménye"
                                autoComplete="off"
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
