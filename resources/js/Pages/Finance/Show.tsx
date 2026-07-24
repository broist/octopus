import { ReactNode, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    Circle,
    Download,
    FileSpreadsheet,
    Package,
    Pencil,
    Plus,
    Receipt,
    Trash2,
    TriangleAlert,
    Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StatusChip from '@/Components/StatusChip';
import CostModal from '@/Pages/Finance/Partials/CostModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type {
    BudgetItem,
    CostItem,
    FinanceCategoryRow,
    FinanceProjectRef,
    FinanceQuote,
    FinanceSummary,
    Option,
} from '@/types/models';

interface ShowProps extends Record<string, unknown> {
    project: FinanceProjectRef;
    summary: FinanceSummary;
    categories: FinanceCategoryRow[];
    budget_items: BudgetItem[];
    costs: CostItem[];
    quotes: FinanceQuote[];
    partners: Option[];
    budget_categories: Record<string, string>;
    cost_categories: Record<string, string>;
}

const huf = new Intl.NumberFormat('hu-HU');
const fmtHuf = (v: number) => `${huf.format(Math.round(v))} Ft`;

const QUOTE_STATUS: Record<string, string> = {
    piszkozat: 'Piszkozat',
    jóváhagyva: 'Jóváhagyva',
};

function Money({ value, bold = false }: { value: number; bold?: boolean }) {
    return (
        <span className={clsx('tabular-nums', bold && 'font-semibold', value < 0 ? 'text-coral' : 'text-ink')}>
            {fmtHuf(value)}
        </span>
    );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
    return (
        <div className="o-card px-4 py-3">
            <div
                className={clsx(
                    'text-xl font-semibold',
                    tone === 'good' && 'text-emerald-600',
                    tone === 'bad' && 'text-coral',
                    !tone && 'text-sidebar',
                )}
            >
                {value}
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
        </div>
    );
}

function CardHeader({
    icon: Icon,
    title,
    count,
    right,
}: {
    icon: typeof Wallet;
    title: string;
    count?: number;
    right?: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-sidebar">
                <Icon size={16} />
                {title}
                {count !== undefined && (
                    <span className="rounded-sm bg-cream px-1.5 py-0.5 text-xs text-ink-faint">{count}</span>
                )}
            </h2>
            {right}
        </div>
    );
}

export default function Show() {
    const {
        project, summary, categories, budget_items, costs, quotes, partners,
        budget_categories, cost_categories, auth,
    } = usePageProps<ShowProps>();

    const canEdit = auth.permissions.includes('finance.edit');
    const canDelete = auth.permissions.includes('finance.delete');

    const [costModal, setCostModal] = useState<{ cost: CostItem | null } | null>(null);

    const contractForm = useForm<{ contract_value: string }>({
        contract_value: project.contract_value != null ? String(project.contract_value) : '',
    });
    const budgetForm = useForm<{ category: string; description: string; amount: string }>({
        category: 'anyag',
        description: '',
        amount: '',
    });

    const submitContract = (e: React.FormEvent) => {
        e.preventDefault();
        contractForm.put(route('finance.contract.update', project.id), { preserveScroll: true });
    };
    const submitBudget = (e: React.FormEvent) => {
        e.preventDefault();
        budgetForm.post(route('finance.budget.store', project.id), {
            preserveScroll: true,
            onSuccess: () => budgetForm.reset('description', 'amount'),
        });
    };

    return (
        <>
            <Head title={`Pénzügy — ${project.code}`} />

            <Link
                href={route('finance.index')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza a pénzügyi áttekintéshez
            </Link>

            <PageHeader
                title={`${project.code} — ${project.name}`}
                actions={
                    <Link href={route('projects.show', project.id)} className="btn-ghost">
                        Projekt megnyitása
                    </Link>
                }
            />

            <div className="mb-5 flex flex-wrap items-center gap-2">
                <StatusChip status={project.status} />
                {project.client_name && <span className="chip chip-grey">{project.client_name}</span>}
                {summary.over_budget && (
                    <span className="chip inline-flex items-center gap-1 bg-coral/10 text-coral">
                        <TriangleAlert size={12} />
                        Költségtúllépés
                    </span>
                )}
            </div>

            {/* Összesítők */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard label="Bevétel" value={fmtHuf(summary.revenue)} />
                <SummaryCard label="Tényleges költség" value={fmtHuf(summary.actual_cost)} />
                <SummaryCard
                    label="Eredmény"
                    value={fmtHuf(summary.profit)}
                    tone={summary.profit < 0 ? 'bad' : 'good'}
                />
                <SummaryCard label="Árrés" value={summary.margin === null ? '—' : `${summary.margin}%`} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Bevétel */}
                <div className="o-card">
                    <CardHeader icon={Wallet} title="Bevétel" />
                    <div className="space-y-4 p-5">
                        <form onSubmit={submitContract} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label className="mb-1 block text-xs text-ink-faint">
                                    Szerződéses (nettó) érték
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={contractForm.data.contract_value}
                                    onChange={(e) => contractForm.setData('contract_value', e.target.value)}
                                    disabled={!canEdit}
                                    placeholder={summary.revenue_from_quote ? 'ajánlatból származtatva' : 'nincs megadva'}
                                    className="w-full rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30 disabled:bg-cream/50"
                                />
                            </div>
                            {canEdit && (
                                <button type="submit" className="btn-primary !py-2" disabled={contractForm.processing}>
                                    Mentés
                                </button>
                            )}
                        </form>
                        {summary.revenue_from_quote && (
                            <p className="text-xs text-ink-faint">
                                Szerződéses érték hiányában a bevétel az elfogadott/kiadott árajánlatból számol.
                            </p>
                        )}

                        <div>
                            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                <FileSpreadsheet size={13} />
                                Árajánlatok
                            </h3>
                            {quotes.length === 0 ? (
                                <p className="text-sm text-ink-faint">Ehhez a projekthez nincs árajánlat.</p>
                            ) : (
                                <div className="divide-y divide-line">
                                    {quotes.map((q) => (
                                        <Link
                                            key={q.id}
                                            href={route('ajanlatok.index')}
                                            className="flex items-center justify-between gap-3 py-2 hover:text-accent"
                                        >
                                            <span className="min-w-0">
                                                <span className="truncate text-sm font-medium text-ink">
                                                    {q.name}
                                                </span>
                                                <span className="ml-2 chip chip-grey">
                                                    {QUOTE_STATUS[q.status] ?? q.status}
                                                </span>
                                            </span>
                                            <span className="tabular-nums text-sm text-ink-soft">
                                                {fmtHuf(q.net_offer)}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Terv vs. tény */}
                <div className="o-card">
                    <CardHeader icon={FileSpreadsheet} title="Terv vs. tény kategóriánként" />
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                                    <th className="px-5 py-2 font-medium">Kategória</th>
                                    <th className="px-5 py-2 text-right font-medium">Terv</th>
                                    <th className="px-5 py-2 text-right font-medium">Tény</th>
                                    <th className="px-5 py-2 text-right font-medium">Eltérés</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {categories.map((c) => {
                                    const diff = c.planned - c.actual;
                                    return (
                                        <tr key={c.key}>
                                            <td className="px-5 py-2 text-ink">{c.label}</td>
                                            <td className="px-5 py-2 text-right tabular-nums text-ink-soft">
                                                {c.planned ? fmtHuf(c.planned) : '—'}
                                            </td>
                                            <td className="px-5 py-2 text-right tabular-nums text-ink-soft">
                                                {c.actual ? fmtHuf(c.actual) : '—'}
                                            </td>
                                            <td
                                                className={clsx(
                                                    'px-5 py-2 text-right tabular-nums',
                                                    c.planned > 0 && diff < 0 ? 'text-coral' : 'text-ink-faint',
                                                )}
                                            >
                                                {c.planned || c.actual ? fmtHuf(diff) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t-2 border-line font-semibold">
                                    <td className="px-5 py-2 text-ink">Összesen</td>
                                    <td className="px-5 py-2 text-right tabular-nums">{fmtHuf(summary.budget)}</td>
                                    <td className="px-5 py-2 text-right tabular-nums">{fmtHuf(summary.actual_cost)}</td>
                                    <td
                                        className={clsx(
                                            'px-5 py-2 text-right tabular-nums',
                                            summary.over_budget && 'text-coral',
                                        )}
                                    >
                                        {fmtHuf(summary.budget - summary.actual_cost)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Költségvetés (terv) */}
            <div className="mt-5 o-card">
                <CardHeader
                    icon={FileSpreadsheet}
                    title="Tervezett költségvetés"
                    count={budget_items.length}
                    right={<span className="text-sm font-semibold text-sidebar">{fmtHuf(summary.budget)}</span>}
                />
                <div className="divide-y divide-line">
                    {budget_items.map((b) => (
                        <div key={b.id} className="flex items-center gap-3 px-5 py-2.5">
                            <span className="chip chip-grey">{b.category_label}</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">{b.description}</span>
                            <span className="tabular-nums text-sm text-ink-soft">{fmtHuf(b.amount)}</span>
                            {canEdit && (
                                <button
                                    onClick={() => {
                                        if (confirm('Törli ezt a költségvetési tételt?')) {
                                            router.delete(route('finance.budget.destroy', b.id), {
                                                preserveScroll: true,
                                            });
                                        }
                                    }}
                                    className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                    title="Törlés"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    ))}
                    {budget_items.length === 0 && (
                        <p className="px-5 py-6 text-center text-sm text-ink-faint">
                            Nincs tervezett költségvetési tétel.
                        </p>
                    )}
                </div>
                {canEdit && (
                    <form
                        onSubmit={submitBudget}
                        className="flex flex-col gap-2 border-t border-line bg-cream/30 px-5 py-3 sm:flex-row sm:items-center"
                    >
                        <select
                            value={budgetForm.data.category}
                            onChange={(e) => budgetForm.setData('category', e.target.value)}
                            className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 sm:w-40"
                        >
                            {Object.entries(budget_categories).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={budgetForm.data.description}
                            onChange={(e) => budgetForm.setData('description', e.target.value)}
                            placeholder="Megnevezés…"
                            className="flex-1 rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                        />
                        <input
                            type="number"
                            min={0}
                            value={budgetForm.data.amount}
                            onChange={(e) => budgetForm.setData('amount', e.target.value)}
                            placeholder="Összeg (Ft)"
                            className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 sm:w-36"
                        />
                        <button
                            type="submit"
                            className="btn-primary !py-1.5"
                            disabled={budgetForm.processing || !budgetForm.data.description || !budgetForm.data.amount}
                        >
                            Hozzáad
                        </button>
                    </form>
                )}
            </div>

            {/* Tényleges költségek */}
            <div className="mt-5 o-card">
                <CardHeader
                    icon={Receipt}
                    title="Tényleges költségek"
                    count={costs.length}
                    right={
                        canEdit && (
                            <button className="btn-ghost !py-1 text-xs" onClick={() => setCostModal({ cost: null })}>
                                <Plus size={14} />
                                Új költség
                            </button>
                        )
                    }
                />
                {/* Anyagköltség — automatikusan az Anyagok modulból */}
                <div className="flex items-center gap-3 border-b border-line bg-cream/20 px-5 py-3">
                    <Package size={16} className="text-ink-faint" />
                    <span className="flex-1 text-sm text-ink">
                        Anyagköltség
                        <span className="ml-2 text-xs text-ink-faint">(automatikus, az Anyagok modulból)</span>
                    </span>
                    <span className="tabular-nums text-sm font-medium text-ink-soft">
                        {fmtHuf(summary.material_cost)}
                    </span>
                </div>

                <div className="divide-y divide-line">
                    {costs.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="chip chip-grey">{c.category_label}</span>
                                    <span className="truncate text-sm font-medium text-ink">{c.description}</span>
                                    {c.is_invoice && (
                                        <span
                                            className={clsx(
                                                'chip inline-flex items-center gap-1',
                                                c.is_paid
                                                    ? 'chip-green'
                                                    : c.overdue
                                                      ? 'bg-coral/15 text-coral'
                                                      : 'chip-amber',
                                            )}
                                        >
                                            <Receipt size={11} />
                                            {c.is_paid ? 'Kifizetve' : c.overdue ? 'Lejárt' : 'Kifizetetlen'}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                                    {c.partner_name && <span>{c.partner_name}</span>}
                                    <span>Teljesítés: {fmtDate(c.incurred_on)}</span>
                                    {c.is_invoice && c.due_on && <span>Határidő: {fmtDate(c.due_on)}</span>}
                                </div>
                            </div>
                            <span className="tabular-nums text-sm text-ink-soft">{fmtHuf(c.amount)}</span>
                            {c.is_invoice && canEdit && (
                                <button
                                    onClick={() =>
                                        router.post(route('finance.costs.toggle-paid', c.id), {}, { preserveScroll: true })
                                    }
                                    className={clsx(
                                        'btn-ghost !p-2',
                                        c.is_paid ? 'text-emerald-600' : 'text-ink-faint hover:text-emerald-600',
                                    )}
                                    title={c.is_paid ? 'Kifizetetlenre állít' : 'Kifizetettként jelöl'}
                                >
                                    {c.is_paid ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                </button>
                            )}
                            {c.download_url && (
                                <a href={c.download_url} className="btn-ghost !p-2" title={c.file_name ?? 'Letöltés'}>
                                    <Download size={15} />
                                </a>
                            )}
                            {canEdit && (
                                <button
                                    onClick={() => setCostModal({ cost: c })}
                                    className="btn-ghost !p-2"
                                    title="Szerkesztés"
                                >
                                    <Pencil size={15} />
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={() => {
                                        if (confirm('Törli ezt a költséget?')) {
                                            router.delete(route('finance.costs.destroy', c.id), {
                                                preserveScroll: true,
                                            });
                                        }
                                    }}
                                    className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                    title="Törlés"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    ))}
                    {costs.length === 0 && (
                        <p className="px-5 py-6 text-center text-sm text-ink-faint">
                            Nincs rögzített (nem anyag) költség. Az anyagköltség automatikusan számol.
                        </p>
                    )}
                </div>
            </div>

            {costModal && (
                <CostModal
                    cost={costModal.cost}
                    projectId={project.id}
                    partners={partners}
                    costCategories={cost_categories}
                    onClose={() => setCostModal(null)}
                />
            )}
        </>
    );
}

Show.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
