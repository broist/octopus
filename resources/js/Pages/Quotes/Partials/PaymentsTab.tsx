import { Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import InputLabel from '@/Components/ui/InputLabel';
import { fmtHuf } from '@/lib/quote';
import type { ProjectCalc } from '@/lib/quote';
import type { QuoteData, QuotePayment } from '@/types/quote';

interface Props {
    data: QuoteData;
    totals: ProjectCalc;
    readOnly: boolean;
    setField: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void;
}

const inputCls =
    'w-full rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 disabled:bg-cream/60';

export default function PaymentsTab({ data, totals, readOnly, setField }: Props) {
    const payments = data.payments ?? [];
    const totalPercent = payments.reduce((s, p) => s + (Number(p.percent) || 0), 0);

    const update = (i: number, patch: Partial<QuotePayment>) => {
        const next = payments.slice();
        next[i] = { ...next[i], ...patch };
        setField('payments', next);
    };
    const add = () => {
        setField('payments', [
            ...payments,
            {
                id: 'pay-' + Math.random().toString(36).slice(2, 9),
                name: 'Új mérföldkő',
                percent: 0,
                condition: '',
            },
        ]);
    };
    const remove = (i: number) => setField('payments', payments.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-4">
            <div className="o-card p-5">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Fizetési ütemezés
                        </h2>
                        <p className="mt-1 text-xs text-ink-faint">
                            A nettó ajánlati ár ({fmtHuf(totals.netOffer)}) felosztása mérföldkövekre.
                        </p>
                    </div>
                    {!readOnly && (
                        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={add}>
                            <Plus size={14} />
                            Mérföldkő
                        </button>
                    )}
                </div>

                {payments.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-faint">
                        Még nincs fizetési mérföldkő.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {payments.map((p, i) => (
                            <div
                                key={p.id}
                                className="grid grid-cols-1 items-end gap-2 rounded-lg border border-line p-3 sm:grid-cols-12"
                            >
                                <div className="sm:col-span-4">
                                    <InputLabel value="Mérföldkő" />
                                    <input
                                        className={inputCls}
                                        value={p.name}
                                        disabled={readOnly}
                                        onChange={(e) => update(i, { name: e.target.value })}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <InputLabel value="Arány (%)" />
                                    <input
                                        type="number"
                                        step="any"
                                        className={clsx(inputCls, 'text-right tabular-nums')}
                                        value={p.percent}
                                        disabled={readOnly}
                                        onChange={(e) =>
                                            update(i, { percent: parseFloat(e.target.value) || 0 })
                                        }
                                    />
                                </div>
                                <div className="sm:col-span-3">
                                    <InputLabel value="Esedékesség" />
                                    <input
                                        className={inputCls}
                                        value={p.condition}
                                        disabled={readOnly}
                                        onChange={(e) => update(i, { condition: e.target.value })}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <InputLabel value="Nettó összeg" />
                                    <div className="py-1.5 text-right text-sm font-semibold tabular-nums text-ink">
                                        {fmtHuf((totals.netOffer * (Number(p.percent) || 0)) / 100)}
                                    </div>
                                </div>
                                {!readOnly && (
                                    <div className="sm:col-span-1 sm:text-right">
                                        <button
                                            onClick={() => remove(i)}
                                            className="rounded p-2 text-ink-faint hover:bg-cream hover:text-coral"
                                            title="Törlés"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {payments.length > 0 && (
                    <div
                        className={clsx(
                            'mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                            Math.abs(totalPercent - 100) < 0.01
                                ? 'bg-accent-50 text-accent-700'
                                : 'bg-amberwarn/10 text-[#8a5e17]',
                        )}
                    >
                        <span>Összes arány</span>
                        <span className="font-semibold tabular-nums">
                            {totalPercent.toLocaleString('hu-HU', { maximumFractionDigits: 1 })}%
                            {Math.abs(totalPercent - 100) >= 0.01 && ' (nem 100%)'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
