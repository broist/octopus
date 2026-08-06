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
    today,
    type ShareInput,
    type SharePayload,
} from '@/Pages/Finance/Partials/ledger';
import type { LedgerCost, LedgerMember } from '@/types/models';

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

interface CostFormData {
    title: string;
    category: string;
    period_month: string;
    due_on: string;
    issued_on: string;
    currency: string;
    amount: string;
    net_amount: string;
    vat_amount: string;
    exchange_rate: string;
    supplier_name: string;
    invoice_number: string;
    note: string;
    shares: SharePayload[];
    [key: string]: string | SharePayload[];
}

export default function SharedCostModal({
    cost,
    members,
    categories,
    currencies,
    onClose,
}: {
    cost: LedgerCost | null;
    members: LedgerMember[];
    categories: Record<string, string>;
    currencies: Record<string, string>;
    onClose: () => void;
}) {
    const [rows, setRows] = useState<ShareInput[]>(() =>
        shareRows(
            members,
            cost ? cost.shares.map((s) => ({ member_id: s.member_id, percent: s.share_percent })) : null,
        ),
    );

    const form = useForm<CostFormData>({
        title: cost?.title ?? '',
        category: cost?.category ?? 'egyeb',
        period_month: toMonthInput(cost?.period_month ?? null),
        due_on: cost?.due_on ?? today(),
        issued_on: cost?.issued_on ?? '',
        currency: cost?.currency ?? 'HUF',
        amount: cost != null ? String(cost.amount) : '',
        net_amount: cost?.net_amount != null ? String(cost.net_amount) : '',
        vat_amount: cost?.vat_amount != null ? String(cost.vat_amount) : '',
        exchange_rate: cost != null ? String(cost.exchange_rate) : '',
        supplier_name: cost?.supplier_name ?? '',
        invoice_number: cost?.invoice_number ?? '',
        note: cost?.note ?? '',
        shares: [],
    });

    const isForeign = form.data.currency !== 'HUF';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({
            ...d,
            period_month: fromMonthInput(String(d.period_month)),
            issued_on: d.issued_on || null,
            net_amount: d.net_amount === '' ? null : d.net_amount,
            vat_amount: d.vat_amount === '' ? null : d.vat_amount,
            exchange_rate: d.exchange_rate === '' ? null : d.exchange_rate,
            shares: sharePayload(rows),
        }));

        const opts = { preserveScroll: true, onSuccess: onClose };
        if (cost) {
            form.put(route('finance.ledger.costs.update', cost.id), opts);
        } else {
            form.post(route('finance.ledger.costs.store'), opts);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex justify-center overflow-y-auto p-3 sm:p-4">
                <DialogPanel className="o-card m-auto w-full max-w-2xl p-4 sm:p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {cost ? 'Költség szerkesztése' : 'Új közös költség'}
                    </DialogTitle>
                    {cost?.needs_review && cost.parse_note && (
                        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {cost.parse_note}
                        </p>
                    )}

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                placeholder="pl. Könyvelési díj – 2026. június"
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
                                <InputLabel value="Elszámolási hónap" />
                                <TextInput
                                    type="month"
                                    value={form.data.period_month}
                                    onChange={(e) => form.setData('period_month', e.target.value)}
                                />
                                <InputError message={form.errors.period_month} />
                            </div>
                            <div>
                                <InputLabel value="Fizetési határidő *" />
                                <TextInput
                                    type="date"
                                    value={form.data.due_on}
                                    onChange={(e) => form.setData('due_on', e.target.value)}
                                />
                                <InputError message={form.errors.due_on} />
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
                                <InputError message={form.errors.currency} />
                            </div>
                            <div>
                                <InputLabel value="Összeg (bruttó) *" />
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
                                <InputLabel
                                    value={isForeign ? 'Árfolyam (1 egység = ? Ft) *' : 'Árfolyam'}
                                />
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

                        {isForeign && (
                            <p className="-mt-1 text-xs text-ink-soft">
                                Az egyenlegek forintban készülnek, ezért a devizás tétel a megadott
                                árfolyammal váltódik át. A mentéskori árfolyam rögzül — később nem
                                írja át visszamenőleg.
                            </p>
                        )}

                        <ShareEditor
                            rows={rows}
                            onChange={setRows}
                            amount={Number(form.data.amount) || 0}
                            currency={form.data.currency}
                            error={form.errors.shares as string | undefined}
                        />

                        <details className="rounded-lg border border-line bg-cream/40 p-3">
                            <summary className="cursor-pointer text-sm font-medium text-ink">
                                Számla adatai (nem kötelező)
                            </summary>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <InputLabel value="Kiállító" />
                                    <TextInput
                                        value={form.data.supplier_name}
                                        onChange={(e) => form.setData('supplier_name', e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <InputLabel value="Számla sorszáma" />
                                    <TextInput
                                        value={form.data.invoice_number}
                                        onChange={(e) => form.setData('invoice_number', e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <InputLabel value="Kiállítás dátuma" />
                                    <TextInput
                                        type="date"
                                        value={form.data.issued_on}
                                        onChange={(e) => form.setData('issued_on', e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <InputLabel value="Nettó" />
                                        <TextInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={form.data.net_amount}
                                            onChange={(e) => form.setData('net_amount', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <InputLabel value="Áfa" />
                                        <TextInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={form.data.vat_amount}
                                            onChange={(e) => form.setData('vat_amount', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <InputLabel value="Megjegyzés" />
                                    <textarea
                                        value={form.data.note}
                                        onChange={(e) => form.setData('note', e.target.value)}
                                        rows={2}
                                        className="block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                                    />
                                </div>
                            </div>
                        </details>

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
