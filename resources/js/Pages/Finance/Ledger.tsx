import { ReactNode, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Banknote,
    Check,
    CheckCircle2,
    FileText,
    FolderOpen,
    Pencil,
    PiggyBank,
    Plus,
    RefreshCw,
    Settings,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import FinanceNav from '@/Pages/Finance/Partials/FinanceNav';
import PaymentModal from '@/Pages/Finance/Partials/PaymentModal';
import SharedCostModal from '@/Pages/Finance/Partials/SharedCostModal';
import { fmtHuf, fmtMoney } from '@/Pages/Finance/Partials/ledger';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { LedgerCost, LedgerMember, LedgerPayment, LedgerWatch } from '@/types/models';

interface LedgerProps extends Record<string, unknown> {
    members: LedgerMember[];
    costs: LedgerCost[];
    payments: LedgerPayment[];
    filters: { year: number | null; open: boolean };
    years: number[];
    categories: Record<string, string>;
    currencies: Record<string, string>;
    watch: LedgerWatch;
    can: { edit: boolean; delete: boolean };
}

const selectClass =
    'rounded-md border-line bg-white py-2 pl-3 pr-8 text-sm focus:border-accent focus:ring-accent/30';

/**
 * A tag egyenlege: pozitív = többet adott be, mint a rá eső rész (a cég
 * tartozik neki), negatív = még be kell fizetnie.
 */
function MemberCard({ member, onPay }: { member: LedgerMember; onPay: () => void }) {
    const owes = member.balance_huf < -0.5;

    return (
        <div className="o-card px-4 py-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-sidebar">{member.name}</div>
                    <div className="text-xs text-ink-faint">
                        {member.default_share.toLocaleString('hu-HU')}%
                        {member.user_name ? ` · ${member.user_name}` : ''}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onPay}
                    title="Befizetés rögzítése"
                    className="shrink-0 rounded-md p-1.5 text-ink-faint transition hover:bg-cream hover:text-accent"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div
                className={clsx(
                    'mt-2 text-xl font-semibold tabular-nums',
                    owes ? 'text-coral' : 'text-emerald-600',
                )}
            >
                {owes ? fmtHuf(Math.abs(member.balance_huf)) : fmtHuf(member.balance_huf)}
            </div>
            <div className="text-xs text-ink-soft">{owes ? 'befizetendő' : 'egyenlege a cégnél'}</div>

            <dl className="mt-2 space-y-0.5 border-t border-line pt-2 text-xs text-ink-soft">
                <div className="flex justify-between">
                    <dt>Rá eső rész</dt>
                    <dd className="tabular-nums">{fmtHuf(member.owed_huf)}</dd>
                </div>
                <div className="flex justify-between">
                    <dt>Befizetve</dt>
                    <dd className="tabular-nums">{fmtHuf(member.paid_huf)}</dd>
                </div>
            </dl>
        </div>
    );
}

function CostCard({
    cost,
    can,
    onEdit,
    onDelete,
    onSettle,
}: {
    cost: LedgerCost;
    can: { edit: boolean; delete: boolean };
    onEdit: () => void;
    onDelete: () => void;
    onSettle: (shareId: number) => void;
}) {
    return (
        <div className="o-card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-sidebar">{cost.title}</h3>
                        <span className="chip bg-cream text-ink-soft">{cost.category_label}</span>
                        {cost.source === 'pdf' && (
                            <span className="chip inline-flex items-center gap-1 bg-accent-50 text-accent-700">
                                <FileText size={11} />
                                Számlából
                            </span>
                        )}
                        {cost.source === 'ismetlodo' && (
                            <span className="chip inline-flex items-center gap-1 bg-cream text-ink-soft">
                                <RefreshCw size={11} />
                                Ismétlődő
                            </span>
                        )}
                        {cost.needs_review && (
                            <span className="chip inline-flex items-center gap-1 bg-amber-100 text-amber-800">
                                <TriangleAlert size={11} />
                                Ellenőrizendő
                            </span>
                        )}
                        {cost.settled ? (
                            <span className="chip inline-flex items-center gap-1 bg-emerald-50 text-emerald-700">
                                <CheckCircle2 size={11} />
                                Rendezve
                            </span>
                        ) : (
                            cost.overdue && (
                                <span className="chip inline-flex items-center gap-1 bg-coral/10 text-coral">
                                    <TriangleAlert size={11} />
                                    Lejárt
                                </span>
                            )
                        )}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                        {cost.period_label && <>Időszak: {cost.period_label} · </>}
                        Határidő: <span className="font-medium">{fmtDate(cost.due_on)}</span>
                        {cost.invoice_number && <> · Számla: {cost.invoice_number}</>}
                        {cost.supplier_name && <> · {cost.supplier_name}</>}
                    </p>
                    {cost.needs_review && cost.parse_note && (
                        <p className="mt-1 text-xs text-amber-700">{cost.parse_note}</p>
                    )}
                </div>

                <div className="flex items-center gap-3 sm:shrink-0">
                    <div className="text-right">
                        <div className="text-lg font-semibold tabular-nums text-sidebar">
                            {fmtMoney(cost.amount, cost.currency)}
                        </div>
                        {cost.currency !== 'HUF' && (
                            <div className="text-[11px] text-ink-faint">
                                {fmtHuf(cost.amount_huf)} ({cost.exchange_rate} Ft/{cost.currency})
                            </div>
                        )}
                        {!cost.settled && (
                            <div className="text-xs text-coral">
                                Nyitott: {fmtHuf(cost.outstanding_huf)}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {cost.document_url && (
                            <Link
                                href={cost.document_url}
                                title="Számla megnyitása a Fájlkezelőben"
                                className="rounded-md p-1.5 text-ink-faint transition hover:bg-cream hover:text-accent"
                            >
                                <FileText size={16} />
                            </Link>
                        )}
                        {can.edit && (
                            <button
                                type="button"
                                onClick={onEdit}
                                title="Szerkesztés"
                                className="rounded-md p-1.5 text-ink-faint transition hover:bg-cream hover:text-accent"
                            >
                                <Pencil size={16} />
                            </button>
                        )}
                        {can.delete && (
                            <button
                                type="button"
                                onClick={onDelete}
                                title="Törlés"
                                className="rounded-md p-1.5 text-ink-faint transition hover:bg-coral/10 hover:text-coral"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <ul className="divide-y divide-line">
                {cost.shares.length === 0 && (
                    <li className="px-4 py-3 text-sm text-ink-soft">
                        Ehhez a tételhez nincs felosztás — szerkessze és válassza ki a tagokat.
                    </li>
                )}
                {cost.shares.map((share) => (
                    /* Telefonon a százalék a név alá kerül — így a névnek és az
                       összegnek is marad hely a 375 px-es képernyőn. */
                    <li key={share.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">
                                {share.member_name}
                            </span>
                            <span className="block text-xs tabular-nums text-ink-faint">
                                {share.share_percent.toLocaleString('hu-HU')}%
                            </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-ink">
                            {fmtMoney(share.amount, cost.currency)}
                        </span>
                        <span className="w-[92px] shrink-0 text-right">
                            {share.settled ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                    <CheckCircle2 size={13} />
                                    Rendezve
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onSettle(share.id)}
                                    className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-ink-soft transition hover:border-accent hover:text-accent"
                                >
                                    <Check size={12} />
                                    Befizetve
                                </button>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function Ledger() {
    const { members, costs, payments, filters, years, categories, currencies, watch, can } =
        usePageProps<LedgerProps>();

    const [costModal, setCostModal] = useState<{ cost: LedgerCost | null } | null>(null);
    const [paymentModal, setPaymentModal] = useState<{
        member_id?: number;
        cost_id?: number;
    } | null>(null);

    const activeMembers = members.filter((m) => m.is_active);
    const totalOutstanding = costs.reduce((sum, c) => sum + c.outstanding_huf, 0);
    const openCount = costs.filter((c) => !c.settled).length;

    const setFilter = (patch: Record<string, string | number | undefined>) => {
        router.get(
            route('finance.ledger'),
            {
                year: filters.year ?? undefined,
                open: filters.open ? 1 : undefined,
                ...patch,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const removeCost = (cost: LedgerCost) => {
        if (!confirm(`Biztosan törli ezt a tételt?\n\n${cost.title}`)) {
            return;
        }
        router.delete(route('finance.ledger.costs.destroy', cost.id), { preserveScroll: true });
    };

    const removePayment = (payment: LedgerPayment) => {
        if (!confirm('Biztosan törli ezt a befizetést?')) {
            return;
        }
        router.delete(route('finance.ledger.payments.destroy', payment.id), { preserveScroll: true });
    };

    return (
        <>
            <Head title="Tagi kölcsön és közös költségek" />

            <PageHeader
                title="Tagi kölcsön"
                subtitle="Ki mennyit fizetett be a céges bankszámlára, és kinek mennyi az esedékes része."
                actions={
                    <>
                        <button
                            type="button"
                            className="btn-ghost inline-flex items-center gap-1.5"
                            onClick={() =>
                                router.post(route('finance.ledger.scan'), {}, { preserveScroll: true })
                            }
                            title="A figyelt mappa új számláinak beolvasása"
                        >
                            <RefreshCw size={15} />
                            Beolvasás
                        </button>
                        <Link
                            href={route('finance.ledger.settings')}
                            className="btn-ghost inline-flex items-center gap-1.5"
                        >
                            <Settings size={15} />
                            Beállítások
                        </Link>
                        <button
                            type="button"
                            className="btn-ghost inline-flex items-center gap-1.5"
                            onClick={() => setPaymentModal({})}
                            disabled={activeMembers.length === 0}
                        >
                            <Banknote size={15} />
                            Befizetés
                        </button>
                        <button
                            type="button"
                            className="btn-primary inline-flex items-center gap-1.5"
                            onClick={() => setCostModal({ cost: null })}
                        >
                            <Plus size={15} />
                            Új költség
                        </button>
                    </>
                }
            />

            <FinanceNav active="ledger" />

            {/* A figyelt mappa: ide feltöltve a számla PDF-jéből magától lesz sor. */}
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-cream/50 px-4 py-2.5 text-sm">
                <FolderOpen size={16} className="shrink-0 text-accent" />
                {watch.path ? (
                    <>
                        <span className="text-ink-soft">Figyelt mappa:</span>
                        <Link href={watch.url ?? '#'} className="font-medium text-accent hover:underline">
                            {watch.path}
                        </Link>
                        <span className="text-xs text-ink-faint">
                            — az ide feltöltött számla PDF-ekből automatikusan keletkezik sor.
                        </span>
                    </>
                ) : (
                    <>
                        <span className="text-amber-700">
                            Nincs beállítva figyelt mappa, ezért a számlák feldolgozása nem indul el.
                        </span>
                        <Link
                            href={route('finance.ledger.settings')}
                            className="font-medium text-accent hover:underline"
                        >
                            Beállítás
                        </Link>
                    </>
                )}
            </div>

            {members.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <PiggyBank size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Először vegye fel a tagokat</h2>
                    <p className="mt-1 max-w-md text-sm text-ink-soft">
                        A közös költségek felosztásához meg kell adni, kik a cég tagjai és milyen
                        arányban viselik a költségeket.
                    </p>
                    <Link href={route('finance.ledger.settings')} className="btn-primary mt-4">
                        Tagok beállítása
                    </Link>
                </div>
            ) : (
                <>
                    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {activeMembers.map((m) => (
                            <MemberCard
                                key={m.id}
                                member={m}
                                onPay={() => setPaymentModal({ member_id: m.id })}
                            />
                        ))}
                    </div>

                    {/* Szűrők */}
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <select
                            value={filters.year ?? ''}
                            onChange={(e) =>
                                setFilter({ year: e.target.value === '' ? undefined : e.target.value })
                            }
                            className={selectClass}
                        >
                            <option value="">Minden év</option>
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={filters.open}
                                onChange={(e) => setFilter({ open: e.target.checked ? 1 : undefined })}
                                className="rounded-sm border-line text-accent focus:ring-accent/40"
                            />
                            Csak a nyitott tételek
                        </label>
                        <span className="text-sm text-ink-soft">
                            {openCount} nyitott tétel · összesen{' '}
                            <span className="font-semibold text-coral">{fmtHuf(totalOutstanding)}</span>{' '}
                            befizetésre vár
                        </span>
                    </div>

                    {costs.length === 0 ? (
                        <div className="o-card px-6 py-12 text-center text-sm text-ink-soft">
                            Ebben az időszakban nincs rögzített közös költség.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {costs.map((cost) => (
                                <CostCard
                                    key={cost.id}
                                    cost={cost}
                                    can={can}
                                    onEdit={() => setCostModal({ cost })}
                                    onDelete={() => removeCost(cost)}
                                    onSettle={(shareId) =>
                                        router.post(
                                            route('finance.ledger.shares.settle', shareId),
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {/* Befizetések */}
                    <div className="o-card mt-6 overflow-hidden">
                        <div className="flex items-center justify-between border-b border-line px-5 py-3">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-sidebar">
                                <Banknote size={16} />
                                Befizetések
                                <span className="rounded-sm bg-cream px-1.5 py-0.5 text-xs text-ink-faint">
                                    {payments.length}
                                </span>
                            </h2>
                        </div>
                        {payments.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-ink-soft">
                                Még nincs rögzített befizetés.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[620px] text-sm">
                                    <thead>
                                        <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                                            <th className="px-4 py-2.5 font-medium">Tag</th>
                                            <th className="px-4 py-2.5 font-medium">Dátum</th>
                                            <th className="px-4 py-2.5 font-medium">Jogcím</th>
                                            <th className="px-4 py-2.5 text-right font-medium">Összeg</th>
                                            <th className="px-4 py-2.5" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {payments.map((p) => (
                                            <tr key={p.id}>
                                                <td className="px-4 py-2.5 font-medium text-ink">
                                                    {p.member_name}
                                                </td>
                                                <td className="px-4 py-2.5 text-ink-soft">
                                                    {fmtDate(p.paid_on)}
                                                </td>
                                                <td className="px-4 py-2.5 text-ink-soft">
                                                    {p.cost_title ?? p.note ?? 'Általános tagi kölcsön'}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                                                    {fmtMoney(p.amount, p.currency)}
                                                    {p.currency !== 'HUF' && (
                                                        <div className="text-[11px] text-ink-faint">
                                                            {fmtHuf(p.amount_huf)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {can.delete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removePayment(p)}
                                                            title="Törlés"
                                                            className="rounded-md p-1.5 text-ink-faint transition hover:bg-coral/10 hover:text-coral"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {costModal && (
                <SharedCostModal
                    cost={costModal.cost}
                    // Minden tag megy át: a felosztás-szerkesztő az inaktívat is
                    // megmutatja, ha egy régi tételben szerepel benne arány.
                    members={members}
                    categories={categories}
                    currencies={currencies}
                    onClose={() => setCostModal(null)}
                />
            )}

            {paymentModal && (
                <PaymentModal
                    members={activeMembers}
                    costs={costs}
                    currencies={currencies}
                    preset={paymentModal}
                    onClose={() => setPaymentModal(null)}
                />
            )}
        </>
    );
}

Ledger.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
