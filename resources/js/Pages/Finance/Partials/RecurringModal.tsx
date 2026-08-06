import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import ShareEditor from '@/Pages/Finance/Partials/ShareEditor';
import {
    fromMonthInput,
    sharePayload,
    shareRows,
    toMonthInput,
    type ShareInput,
    type SharePayload,
} from '@/Pages/Finance/Partials/ledger';
import type { LedgerMemberSetting, LedgerRecurring } from '@/types/models';

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

interface RecurringFormData {
    title: string;
    category: string;
    currency: string;
    amount: string;
    exchange_rate: string;
    due_day: string;
    start_month: string;
    is_active: boolean;
    note: string;
    shares: SharePayload[];
    [key: string]: string | boolean | SharePayload[];
}

/**
 * Ismétlődő közös költség (pl. ChatGPT-előfizetés: minden hónap 7-én esedékes,
 * és csak három tagot érint). Az ütemező havonta legyártja belőle a tételt.
 */
export default function RecurringModal({
    recurring,
    members,
    categories,
    currencies,
    onClose,
}: {
    recurring: LedgerRecurring | null;
    members: LedgerMemberSetting[];
    categories: Record<string, string>;
    currencies: Record<string, string>;
    onClose: () => void;
}) {
    const [rows, setRows] = useState<ShareInput[]>(() =>
        shareRows(members, recurring ? recurring.shares : null),
    );

    const form = useForm<RecurringFormData>({
        title: recurring?.title ?? '',
        category: recurring?.category ?? 'szoftver',
        currency: recurring?.currency ?? 'HUF',
        amount: recurring != null ? String(recurring.amount) : '',
        exchange_rate: recurring != null ? String(recurring.exchange_rate) : '',
        due_day: recurring != null ? String(recurring.due_day) : '7',
        start_month: toMonthInput(recurring?.start_month ?? null),
        is_active: recurring?.is_active ?? true,
        note: recurring?.note ?? '',
        shares: [],
    });

    const isForeign = form.data.currency !== 'HUF';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({
            ...d,
            start_month: fromMonthInput(String(d.start_month)),
            exchange_rate: d.exchange_rate === '' ? null : d.exchange_rate,
            is_active: d.is_active ? 1 : 0,
            shares: sharePayload(rows),
        }));

        const opts = { preserveScroll: true, onSuccess: onClose };
        if (recurring) {
            form.put(route('finance.ledger.recurring.update', recurring.id), opts);
        } else {
            form.post(route('finance.ledger.recurring.store'), opts);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex justify-center overflow-y-auto p-3 sm:p-4">
                <DialogPanel className="o-card m-auto w-full max-w-xl p-4 sm:p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {recurring ? 'Ismétlődő költség szerkesztése' : 'Új ismétlődő költség'}
                    </DialogTitle>
                    <p className="mt-1 text-sm text-ink-soft">
                        Havonta egyszer automatikusan létrejön belőle egy esedékes tétel.
                    </p>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                placeholder="pl. ChatGPT előfizetés"
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.title} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                                <InputLabel value="Kategória *" />
                                <select
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(categories).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.category} />
                            </div>
                            <div>
                                <InputLabel value="Esedékes (hónap napja) *" />
                                <TextInput
                                    type="number"
                                    min={1}
                                    max={31}
                                    step="1"
                                    value={form.data.due_day}
                                    onChange={(e) => form.setData('due_day', e.target.value)}
                                />
                                <InputError message={form.errors.due_day} />
                            </div>
                            <div>
                                <InputLabel value="Első hónap" />
                                <TextInput
                                    type="month"
                                    value={form.data.start_month}
                                    onChange={(e) => form.setData('start_month', e.target.value)}
                                />
                                <InputError message={form.errors.start_month} />
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
                                    placeholder={isForeign ? 'pl. 365' : '—'}
                                    onChange={(e) => form.setData('exchange_rate', e.target.value)}
                                />
                                <InputError message={form.errors.exchange_rate} />
                            </div>
                        </div>

                        <ShareEditor
                            rows={rows}
                            onChange={setRows}
                            amount={Number(form.data.amount) || 0}
                            currency={form.data.currency}
                            error={form.errors.shares as string | undefined}
                        />

                        <div>
                            <InputLabel value="Megjegyzés" />
                            <TextInput
                                value={form.data.note}
                                onChange={(e) => form.setData('note', e.target.value)}
                                autoComplete="off"
                            />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={form.data.is_active}
                                onChange={(e) => form.setData('is_active', e.target.checked)}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            Aktív (havonta generálódik)
                        </label>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {recurring ? 'Mentés' : 'Létrehozás'}
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
