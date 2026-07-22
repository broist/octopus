import { useState } from 'react';
import {
    ChevronDown,
    Copy,
    Plus,
    Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import InputLabel from '@/Components/ui/InputLabel';
import { calcCategory, calcItem, fmtHuf, fmtPercent } from '@/lib/quote';
import type { ProfitMode, QuoteCategory, QuoteData, QuoteItem } from '@/types/quote';
import type { ProjectCalc } from '@/lib/quote';

interface Props {
    data: QuoteData;
    totals: ProjectCalc;
    readOnly: boolean;
    setField: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void;
    setCategory: (ci: number, patch: Partial<QuoteCategory>) => void;
    setItem: (ci: number, ii: number, patch: Partial<QuoteItem>) => void;
    addCategory: () => void;
    removeCategory: (ci: number) => void;
    addItem: (ci: number) => void;
    duplicateItem: (ci: number, ii: number) => void;
    removeItem: (ci: number, ii: number) => void;
}

const inputCls =
    'w-full rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 disabled:bg-cream/60 disabled:text-ink-faint';
const numCls =
    'rounded-md border-line bg-white py-1.5 text-right text-sm tabular-nums focus:border-accent focus:ring-accent/30 disabled:bg-cream/60';
const selCls =
    'rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 disabled:bg-cream/60';

const PROFIT_MODES: { value: ProfitMode; label: string }[] = [
    { value: 'markup', label: 'Haszonkulcs %' },
    { value: 'multiplier', label: 'Szorzó' },
    { value: 'fixed', label: 'Fix végösszeg' },
];

function Num({
    value,
    onChange,
    disabled,
    className,
    step,
}: {
    value: number;
    onChange: (n: number) => void;
    disabled?: boolean;
    className?: string;
    step?: string;
}) {
    return (
        <input
            type="number"
            inputMode="decimal"
            step={step ?? 'any'}
            value={Number.isFinite(value) ? value : 0}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
            onFocus={(e) => e.target.select()}
            className={clsx(numCls, className)}
        />
    );
}

export default function CalculationTab({
    data,
    totals,
    readOnly,
    setField,
    setCategory,
    setItem,
    addCategory,
    removeCategory,
    addItem,
    duplicateItem,
    removeItem,
}: Props) {
    const [compact, setCompact] = useState(true);

    return (
        <div className="space-y-5">
            {/* Projekt-metaadatok */}
            <div className="o-card p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                    Ajánlat adatai
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Projekt megnevezése">
                        <input
                            className={inputCls}
                            value={data.projectName ?? ''}
                            disabled={readOnly}
                            onChange={(e) => setField('projectName', e.target.value)}
                        />
                    </Field>
                    <Field label="Ajánlatszám">
                        <input
                            className={inputCls}
                            value={data.quoteNumber ?? ''}
                            disabled={readOnly}
                            onChange={(e) => setField('quoteNumber', e.target.value)}
                        />
                    </Field>
                    <Field label="Megrendelő">
                        <input
                            className={inputCls}
                            value={data.clientName ?? ''}
                            disabled={readOnly}
                            onChange={(e) => setField('clientName', e.target.value)}
                        />
                    </Field>
                    <Field label="Helyszín">
                        <input
                            className={inputCls}
                            value={data.location ?? ''}
                            disabled={readOnly}
                            onChange={(e) => setField('location', e.target.value)}
                        />
                    </Field>
                    <Field label="Ajánlat kelte">
                        <input
                            type="date"
                            className={inputCls}
                            value={data.quoteDate ?? ''}
                            disabled={readOnly}
                            onChange={(e) => setField('quoteDate', e.target.value)}
                        />
                    </Field>
                    <Field label="Érvényesség">
                        <input
                            type="date"
                            className={inputCls}
                            value={data.validUntil ?? ''}
                            disabled={readOnly}
                            onChange={(e) => setField('validUntil', e.target.value)}
                        />
                    </Field>
                </div>
            </div>

            {/* Globális haszonkulcs + korrekciók */}
            <div className="o-card p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                    Globális haszonkulcs és korrekciók
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    <Field label="Haszonkulcs módja">
                        <select
                            className={clsx(selCls, 'w-full')}
                            value={data.globalProfitMode}
                            disabled={readOnly}
                            onChange={(e) => setField('globalProfitMode', e.target.value as ProfitMode)}
                        >
                            {PROFIT_MODES.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Haszonkulcs értéke">
                        <Num
                            className="w-full"
                            value={data.globalProfitValue}
                            disabled={readOnly}
                            onChange={(n) => setField('globalProfitValue', n)}
                        />
                    </Field>
                    <Field label="ÁFA (%)">
                        <Num
                            className="w-full"
                            value={data.vatRate}
                            disabled={readOnly}
                            onChange={(n) => setField('vatRate', n)}
                        />
                    </Field>
                    <Field label="Kedvezmény (Ft)">
                        <Num
                            className="w-full"
                            value={data.discount}
                            disabled={readOnly}
                            onChange={(n) => setField('discount', n)}
                        />
                    </Field>
                    <Field label="Tartalékkeret (Ft)">
                        <Num
                            className="w-full"
                            value={data.contingency}
                            disabled={readOnly}
                            onChange={(n) => setField('contingency', n)}
                        />
                    </Field>
                    <Field label="Projektköltség (Ft)">
                        <Num
                            className="w-full"
                            value={data.projectCost}
                            disabled={readOnly}
                            onChange={(n) => setField('projectCost', n)}
                        />
                    </Field>
                    <Field label="Kerekítés (Ft)">
                        <Num
                            className="w-full"
                            value={data.rounding}
                            disabled={readOnly}
                            onChange={(n) => setField('rounding', n)}
                        />
                    </Field>
                </div>
            </div>

            {/* Munkanemek + tételek */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                    Munkanemek és tételek
                </h2>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <input
                            type="checkbox"
                            checked={compact}
                            onChange={(e) => setCompact(e.target.checked)}
                            className="rounded-sm border-line text-accent focus:ring-accent/40"
                        />
                        Kompakt nézet
                    </label>
                    {!readOnly && (
                        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={addCategory}>
                            <Plus size={14} />
                            Munkanem
                        </button>
                    )}
                </div>
            </div>

            {data.categories.map((category, ci) => (
                <CategoryCard
                    key={category.id}
                    data={data}
                    category={category}
                    ci={ci}
                    compact={compact}
                    readOnly={readOnly}
                    setCategory={setCategory}
                    setItem={setItem}
                    addItem={addItem}
                    removeCategory={removeCategory}
                    duplicateItem={duplicateItem}
                    removeItem={removeItem}
                />
            ))}

            {/* Projektösszesítő (a lista alján, külön blokkban) */}
            <div className="o-card overflow-hidden">
                <div className="bg-sidebar px-5 py-3 text-sm font-semibold text-white">
                    Projektösszesítő
                </div>
                <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
                    <Summary label="Kalkulált tételösszeg" value={fmtHuf(totals.itemOffer)} />
                    <Summary label="Nettó ajánlati ár" value={fmtHuf(totals.netOffer)} strong />
                    <Summary label={`ÁFA (${fmtPercent(data.vatRate)})`} value={fmtHuf(totals.vat)} />
                    <Summary label="Bruttó ajánlati ár" value={fmtHuf(totals.grossOffer)} accent />
                </div>
                <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
                    <Summary label="Költségalap" value={fmtHuf(totals.baseCost)} muted />
                    <Summary label="Tervezett nyereség" value={fmtHuf(totals.profit)} muted />
                    <Summary label="Árrés" value={fmtPercent(totals.margin)} muted />
                    <Summary label="Haszonkulcs" value={fmtPercent(totals.markup)} muted />
                </div>
            </div>
        </div>
    );
}

function CategoryCard({
    data,
    category,
    ci,
    compact,
    readOnly,
    setCategory,
    setItem,
    addItem,
    removeCategory,
    duplicateItem,
    removeItem,
}: {
    data: QuoteData;
    category: QuoteCategory;
    ci: number;
    compact: boolean;
    readOnly: boolean;
    setCategory: Props['setCategory'];
    setItem: Props['setItem'];
    addItem: Props['addItem'];
    removeCategory: Props['removeCategory'];
    duplicateItem: Props['duplicateItem'];
    removeItem: Props['removeItem'];
}) {
    const cc = calcCategory(data, category);
    const activeItems = category.items.filter((i) => i.active).length;

    return (
        <div
            className={clsx(
                'o-card overflow-hidden',
                !category.active && 'opacity-60',
            )}
        >
            {/* Munkanem fejléc */}
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-sidebar/5 px-4 py-2.5">
                <button
                    onClick={() => setCategory(ci, { collapsed: !category.collapsed })}
                    className="text-ink-soft hover:text-ink"
                    title={category.collapsed ? 'Kinyitás' : 'Összecsukás'}
                >
                    <ChevronDown
                        size={18}
                        className={clsx('transition-transform', category.collapsed && '-rotate-90')}
                    />
                </button>
                <input
                    className={clsx(inputCls, 'min-w-0 flex-1 font-medium')}
                    value={category.title}
                    disabled={readOnly}
                    onChange={(e) => setCategory(ci, { title: e.target.value })}
                />
                <span className="chip chip-grey shrink-0">{activeItems} tétel</span>
                <span className="shrink-0 text-sm font-semibold text-ink">{fmtHuf(cc.offer)}</span>
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
                    <input
                        type="checkbox"
                        checked={category.active}
                        disabled={readOnly}
                        onChange={(e) => setCategory(ci, { active: e.target.checked })}
                        className="rounded-sm border-line text-accent focus:ring-accent/40"
                    />
                    Aktív
                </label>
                {!readOnly && (
                    <button
                        onClick={() => {
                            if (confirm(`Törli a(z) „${category.title}” munkanemet?`)) removeCategory(ci);
                        }}
                        className="shrink-0 rounded p-1.5 text-ink-faint hover:bg-white hover:text-coral"
                        title="Munkanem törlése"
                    >
                        <Trash2 size={15} />
                    </button>
                )}
            </div>

            {!category.collapsed && (
                <>
                    {/* Munkanem-szintű haszonkulcs felülírás */}
                    {!readOnly && (
                        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-4 py-2 text-xs">
                            <label className="flex items-center gap-1.5 text-ink-soft">
                                <input
                                    type="checkbox"
                                    checked={category.profitOverride}
                                    onChange={(e) => setCategory(ci, { profitOverride: e.target.checked })}
                                    className="rounded-sm border-line text-accent focus:ring-accent/40"
                                />
                                Egyedi haszonkulcs a munkanemre
                            </label>
                            {category.profitOverride && (
                                <>
                                    <select
                                        className={clsx(selCls, 'py-1 text-xs')}
                                        value={category.profitMode}
                                        onChange={(e) =>
                                            setCategory(ci, { profitMode: e.target.value as ProfitMode })
                                        }
                                    >
                                        {PROFIT_MODES.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                    <Num
                                        className="w-24 py-1 text-xs"
                                        value={category.profitValue}
                                        onChange={(n) => setCategory(ci, { profitValue: n })}
                                    />
                                </>
                            )}
                        </div>
                    )}

                    {/* Tételtábla — saját vízszintes görgetéssel */}
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line bg-cream/60 text-left text-[11px] uppercase tracking-wide text-ink-faint">
                                    <th className="px-2 py-2 font-semibold">Megnevezés</th>
                                    <th className="px-2 py-2 text-right font-semibold">Menny.</th>
                                    <th className="px-2 py-2 font-semibold">Egys.</th>
                                    <th className="px-2 py-2 text-right font-semibold">Saját anyag e.ár</th>
                                    <th className="px-2 py-2 text-right font-semibold">Saját díj e.ár</th>
                                    {!compact && (
                                        <>
                                            <th className="px-2 py-2 text-right font-semibold">Alváll. anyag</th>
                                            <th className="px-2 py-2 text-right font-semibold">Alváll. díj</th>
                                        </>
                                    )}
                                    <th className="px-2 py-2 font-semibold">Alap</th>
                                    <th className="px-2 py-2 text-right font-semibold">Költségalap</th>
                                    <th className="px-2 py-2 text-right font-semibold">Ajánlati ár</th>
                                    {!compact && (
                                        <th className="px-2 py-2 text-right font-semibold">Árrés</th>
                                    )}
                                    <th className="px-2 py-2 text-center font-semibold">Aktív</th>
                                    {!readOnly && <th className="px-2 py-2" />}
                                </tr>
                            </thead>
                            <tbody>
                                {category.items.map((item, ii) => {
                                    const c = calcItem(data, category, item);
                                    return (
                                        <tr
                                            key={item.id}
                                            className={clsx(
                                                'border-b border-line/70 align-top',
                                                !item.active && 'bg-cream/40 text-ink-faint',
                                            )}
                                        >
                                            <td className="px-2 py-1.5" style={{ minWidth: 220 }}>
                                                <input
                                                    className={clsx(inputCls, 'text-xs')}
                                                    value={item.description}
                                                    disabled={readOnly}
                                                    onChange={(e) =>
                                                        setItem(ci, ii, { description: e.target.value })
                                                    }
                                                />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <Num
                                                    className="w-20"
                                                    value={item.quantity}
                                                    disabled={readOnly}
                                                    onChange={(n) => setItem(ci, ii, { quantity: n })}
                                                />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <input
                                                    className={clsx(inputCls, 'w-16 text-xs')}
                                                    value={item.unit}
                                                    disabled={readOnly}
                                                    onChange={(e) => setItem(ci, ii, { unit: e.target.value })}
                                                />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <Num
                                                    className="w-24"
                                                    value={item.ownMaterialUnit}
                                                    disabled={readOnly}
                                                    onChange={(n) => setItem(ci, ii, { ownMaterialUnit: n })}
                                                />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <Num
                                                    className="w-24"
                                                    value={item.ownLaborUnit}
                                                    disabled={readOnly}
                                                    onChange={(n) => setItem(ci, ii, { ownLaborUnit: n })}
                                                />
                                            </td>
                                            {!compact && (
                                                <>
                                                    <td className="px-2 py-1.5">
                                                        <Num
                                                            className="w-24"
                                                            value={item.subMaterialUnit}
                                                            disabled={readOnly}
                                                            onChange={(n) =>
                                                                setItem(ci, ii, { subMaterialUnit: n })
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <Num
                                                            className="w-24"
                                                            value={item.subLaborUnit}
                                                            disabled={readOnly}
                                                            onChange={(n) =>
                                                                setItem(ci, ii, { subLaborUnit: n })
                                                            }
                                                        />
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-2 py-1.5">
                                                <select
                                                    className={clsx(selCls, 'text-xs')}
                                                    value={item.basis}
                                                    disabled={readOnly}
                                                    onChange={(e) =>
                                                        setItem(ci, ii, {
                                                            basis: e.target.value as QuoteItem['basis'],
                                                        })
                                                    }
                                                >
                                                    <option value="own">Saját</option>
                                                    <option value="sub">Alváll.</option>
                                                    <option value="manual">Manuális</option>
                                                </select>
                                                {item.basis === 'manual' && (
                                                    <Num
                                                        className="mt-1 w-24"
                                                        value={item.manualBase}
                                                        disabled={readOnly}
                                                        onChange={(n) => setItem(ci, ii, { manualBase: n })}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-2 py-1.5 text-right tabular-nums text-ink-soft">
                                                {fmtHuf(c.base)}
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-ink">
                                                {fmtHuf(c.offer)}
                                            </td>
                                            {!compact && (
                                                <td className="px-2 py-1.5 text-right tabular-nums text-ink-faint">
                                                    {fmtPercent(c.margin)}
                                                </td>
                                            )}
                                            <td className="px-2 py-1.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.active}
                                                    disabled={readOnly}
                                                    onChange={(e) =>
                                                        setItem(ci, ii, { active: e.target.checked })
                                                    }
                                                    className="rounded-sm border-line text-accent focus:ring-accent/40"
                                                />
                                            </td>
                                            {!readOnly && (
                                                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                                                    <button
                                                        onClick={() => duplicateItem(ci, ii)}
                                                        className="rounded p-1 text-ink-faint hover:bg-cream hover:text-ink"
                                                        title="Másolás"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => removeItem(ci, ii)}
                                                        className="rounded p-1 text-ink-faint hover:bg-cream hover:text-coral"
                                                        title="Törlés"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {category.items.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="px-3 py-4 text-center text-sm text-ink-faint">
                                            Nincs tétel ebben a munkanemben.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!readOnly && (
                        <div className="border-t border-line px-4 py-2">
                            <button
                                onClick={() => addItem(ci)}
                                className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-700"
                            >
                                <Plus size={13} />
                                Új tétel
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <InputLabel value={label} />
            {children}
        </div>
    );
}

function Summary({
    label,
    value,
    strong,
    accent,
    muted,
}: {
    label: string;
    value: string;
    strong?: boolean;
    accent?: boolean;
    muted?: boolean;
}) {
    return (
        <div className={clsx('bg-white px-4 py-3', muted && 'bg-cream/40')}>
            <div className="text-xs text-ink-faint">{label}</div>
            <div
                className={clsx(
                    'mt-0.5 tabular-nums',
                    accent ? 'text-lg font-bold text-accent' : strong ? 'text-lg font-semibold text-ink' : 'text-sm font-medium text-ink',
                )}
            >
                {value}
            </div>
        </div>
    );
}
