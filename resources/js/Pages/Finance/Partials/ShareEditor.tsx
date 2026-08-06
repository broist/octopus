import clsx from 'clsx';
import InputLabel from '@/Components/ui/InputLabel';
import { fmtMoney, type ShareInput } from '@/Pages/Finance/Partials/ledger';

/**
 * Ki és milyen arányban viseli a költséget. A könyvelői számla mind a négy
 * tagot érinti, egy szoftver-előfizetés viszont csak néhányukat — ezért a
 * résztvevők és a százalékok tételenként állíthatók.
 *
 * A százalékok összegét egyben mutatja: nem kell 100-ra kijönnie (arányként is
 * megadható, pl. 1-1-1), a felosztás mindig arányosan és pontosan történik.
 */
export default function ShareEditor({
    rows,
    onChange,
    amount,
    currency,
    error,
}: {
    rows: ShareInput[];
    onChange: (rows: ShareInput[]) => void;
    amount: number;
    currency: string;
    error?: string;
}) {
    const selected = rows.filter((r) => r.checked);
    const total = selected.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);

    const update = (memberId: number, patch: Partial<ShareInput>) => {
        onChange(rows.map((r) => (r.member_id === memberId ? { ...r, ...patch } : r)));
    };

    const preview = (row: ShareInput): string => {
        if (!row.checked || total <= 0 || !amount) {
            return '—';
        }
        const value = (amount * (Number(row.percent) || 0)) / total;

        return fmtMoney(value, currency);
    };

    return (
        <div>
            <InputLabel value="Kik viselik és milyen arányban *" />
            <div className="mt-1 divide-y divide-line rounded-lg border border-line">
                {rows.length === 0 && (
                    <p className="px-3 py-4 text-sm text-ink-soft">
                        Még nincs felvett cégtag. Vegye fel őket a beállításoknál.
                    </p>
                )}
                {rows.map((row) => (
                    <label
                        key={row.member_id}
                        className={clsx(
                            'flex items-center gap-2.5 px-3 py-2.5 text-sm',
                            !row.checked && 'opacity-60',
                        )}
                    >
                        <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) => update(row.member_id, { checked: e.target.checked })}
                            className="shrink-0 rounded-sm border-line text-accent focus:ring-accent/40"
                        />
                        {/* A rá eső összeg a név alatt: telefonon is elfér. */}
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">{row.name}</span>
                            <span className="block tabular-nums text-xs text-ink-faint">
                                {preview(row)}
                            </span>
                        </span>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.001"
                            value={row.percent}
                            disabled={!row.checked}
                            onChange={(e) => update(row.member_id, { percent: e.target.value })}
                            className="w-20 shrink-0 rounded-md border-line bg-white py-1 text-right text-sm tabular-nums focus:border-accent focus:ring-accent/30 disabled:bg-cream/60"
                        />
                        <span className="shrink-0 text-xs text-ink-faint">%</span>
                    </label>
                ))}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
                <span className={clsx(total === 100 ? 'text-ink-faint' : 'text-amber-600')}>
                    Arányok összege: {total.toLocaleString('hu-HU')}%
                    {total !== 100 && total > 0 && ' — a felosztás ehhez az összeghez arányosítva történik'}
                </span>
                {error && <span className="text-coral">{error}</span>}
            </div>
        </div>
    );
}
