import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Search, TriangleAlert, Wallet } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StatusChip from '@/Components/StatusChip';
import { usePageProps } from '@/hooks/usePageProps';
import type { FinanceRow } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    projects: FinanceRow[];
    filters: { search: string };
    totals: { revenue: number; actual_cost: number; profit: number; over_budget: number };
}

const huf = new Intl.NumberFormat('hu-HU');
const fmtHuf = (v: number) => `${huf.format(Math.round(v))} Ft`;

function SummaryCard({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: 'good' | 'bad' | 'coral';
}) {
    return (
        <div className="o-card px-4 py-3">
            <div
                className={clsx(
                    'text-xl font-semibold',
                    tone === 'good' && 'text-emerald-600',
                    tone === 'bad' && 'text-coral',
                    tone === 'coral' && 'text-coral',
                    !tone && 'text-sidebar',
                )}
            >
                {value}
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
        </div>
    );
}

function Money({ value, bold = false }: { value: number; bold?: boolean }) {
    return (
        <span
            className={clsx(
                'tabular-nums',
                bold && 'font-semibold',
                value < 0 ? 'text-coral' : 'text-ink',
            )}
        >
            {fmtHuf(value)}
        </span>
    );
}

export default function Index() {
    const { projects, filters, totals } = usePageProps<IndexProps>();

    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('finance.index'),
                { search: search || undefined },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    return (
        <>
            <Head title="Pénzügy / Költségvetés" />

            <PageHeader
                title="Pénzügy / Költségvetés"
                subtitle="Projektenkénti bevétel, tényleges költség és nyereségesség — terv-vs-tény."
            />

            {/* Összesítők */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard label="Összes bevétel" value={fmtHuf(totals.revenue)} />
                <SummaryCard label="Összes tényleges költség" value={fmtHuf(totals.actual_cost)} />
                <SummaryCard
                    label="Eredmény"
                    value={fmtHuf(totals.profit)}
                    tone={totals.profit < 0 ? 'bad' : 'good'}
                />
                <SummaryCard
                    label="Költségtúllépő projekt"
                    value={String(totals.over_budget)}
                    tone={totals.over_budget > 0 ? 'coral' : undefined}
                />
            </div>

            {/* Kereső */}
            <div className="mb-5 sm:max-w-xs">
                <div className="relative">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Keresés projekt neve, kódja…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
            </div>

            {projects.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <Wallet size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs megjeleníthető projekt</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search
                            ? 'Módosítsa a keresést.'
                            : 'A projektek pénzügyi adatai itt jelennek meg, amint van projekt.'}
                    </p>
                </div>
            ) : (
                <div className="o-card overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                                <th className="px-4 py-2.5 font-medium">Projekt</th>
                                <th className="px-4 py-2.5 text-right font-medium">Bevétel</th>
                                <th className="px-4 py-2.5 text-right font-medium">Költség</th>
                                <th className="px-4 py-2.5 text-right font-medium">Eredmény</th>
                                <th className="px-4 py-2.5 text-right font-medium">Árrés</th>
                                <th className="px-4 py-2.5 text-right font-medium">Státusz</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {projects.map((p) => (
                                <tr
                                    key={p.id}
                                    onClick={() => router.get(route('finance.show', p.id))}
                                    className="cursor-pointer transition hover:bg-cream/50"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-ink-faint">{p.code}</span>
                                            <span className="font-medium text-ink">{p.name}</span>
                                            {p.over_budget && (
                                                <span
                                                    className="chip inline-flex items-center gap-1 bg-coral/10 text-coral"
                                                    title="A tényleges költség meghaladja a tervezett költségvetést"
                                                >
                                                    <TriangleAlert size={11} />
                                                    Túllépés
                                                </span>
                                            )}
                                        </div>
                                        {p.client_name && (
                                            <div className="text-xs text-ink-faint">{p.client_name}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Money value={p.revenue} />
                                        {p.revenue_from_quote && (
                                            <div className="text-[10px] text-ink-faint">ajánlatból</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Money value={p.actual_cost} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Money value={p.profit} bold />
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                                        {p.margin === null ? '—' : `${p.margin}%`}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <StatusChip status={p.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
