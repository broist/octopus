import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Building2,
    HardHat,
    Plus,
    Search,
    Star,
    TriangleAlert,
    User as UserIcon,
    Users,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import SubcontractorModal from '@/Pages/Subcontractors/Partials/SubcontractorModal';
import { usePageProps } from '@/hooks/usePageProps';
import type { Paginator, SubcontractorListItem } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    subcontractors: Paginator<SubcontractorListItem>;
    filters: { search: string; trade: string };
    trades: Record<string, string>;
    stats: { total: number; expiring: number; trades: number };
}

const selectClass =
    'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

function paginationLabel(label: string): string {
    return label
        .replace('&laquo;', '«')
        .replace('&raquo;', '»')
        .replace('Previous', 'Előző')
        .replace('Next', 'Következő');
}

function StatTile({
    label,
    value,
    tone,
    active,
    onClick,
}: {
    label: string;
    value: number;
    tone?: 'coral';
    active?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx(
                'o-card px-4 py-3 text-left transition',
                onClick && 'hover:border-accent/40',
                active && 'border-accent ring-1 ring-accent/30',
            )}
        >
            <div
                className={clsx(
                    'text-2xl font-semibold',
                    tone === 'coral' && value > 0 ? 'text-coral' : 'text-sidebar',
                )}
            >
                {value}
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
        </button>
    );
}

function RatingStars({ value }: { value: number | null }) {
    if (value === null) {
        return <span className="text-xs text-ink-faint">Nincs értékelés</span>;
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-ink-soft" title={`${value} / 5`}>
            <Star size={13} className="fill-amber-400 text-amber-400" />
            {value.toFixed(1)}
        </span>
    );
}

export default function Index() {
    const { subcontractors, filters, trades, stats, auth } = usePageProps<IndexProps>();
    const canCreate = auth.permissions.includes('subcontractors.create');

    const [modalOpen, setModalOpen] = useState(false);
    const [search, setSearch] = useState(filters.search);
    const [trade, setTrade] = useState(filters.trade);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('subcontractors.index'),
                { search: search || undefined, trade: trade || undefined },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, trade]);

    return (
        <>
            <Head title="Alvállalkozók" />

            <PageHeader
                title="Alvállalkozók"
                subtitle="A cég alvállalkozói: szakma, kapacitás, dokumentumok lejárattal és teljesítmény-értékelés."
                actions={
                    canCreate && (
                        <button className="btn-primary" onClick={() => setModalOpen(true)}>
                            <Plus size={16} />
                            Új alvállalkozó
                        </button>
                    )
                }
            />

            {/* Statisztika-csempék */}
            <div className="mb-5 grid grid-cols-3 gap-3">
                <StatTile label="Összes alvállalkozó" value={stats.total} />
                <StatTile label="Lejáró dokumentum" value={stats.expiring} tone="coral" />
                <StatTile label="Szakma a listában" value={stats.trades} />
            </div>

            {/* Szűrők */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Keresés név, kapcsolattartó, e-mail…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
                <select
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    className={`${selectClass} sm:w-56`}
                >
                    <option value="">Minden szakma</option>
                    {Object.entries(trades).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            {subcontractors.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <HardHat size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">
                        Nincs a szűrésnek megfelelő alvállalkozó
                    </h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search || filters.trade
                            ? 'Módosítsa a keresést vagy a szakma-szűrőt.'
                            : 'Vegye fel az első alvállalkozót — szakma, dokumentumok és értékelés is rögzíthető.'}
                    </p>
                    {canCreate && !filters.search && !filters.trade && (
                        <button className="btn-primary mt-5" onClick={() => setModalOpen(true)}>
                            <Plus size={16} />
                            Első alvállalkozó felvétele
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {subcontractors.data.map((s) => (
                        <Link
                            key={s.id}
                            href={route('subcontractors.show', s.id)}
                            className="flex flex-col gap-3 px-4 py-3 transition hover:bg-cream/50 sm:flex-row sm:items-center"
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span
                                    className={clsx(
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                                        s.is_company
                                            ? 'bg-accent-50 text-accent'
                                            : 'bg-sidebar/10 text-sidebar',
                                    )}
                                >
                                    {s.is_company ? <Building2 size={18} /> : <UserIcon size={18} />}
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-ink">
                                            {s.name}
                                        </span>
                                        {s.expiring_count > 0 && (
                                            <span
                                                className="chip inline-flex items-center gap-1 bg-coral/10 text-coral"
                                                title="Lejáró vagy lejárt dokumentum"
                                            >
                                                <TriangleAlert size={11} />
                                                {s.expiring_count}
                                            </span>
                                        )}
                                    </div>
                                    <div className="truncate text-xs text-ink-faint">
                                        {s.contact_name || s.email || '—'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:w-64">
                                {s.trade_label && (
                                    <span className="chip bg-sidebar/10 text-sidebar">
                                        {s.trade_label}
                                    </span>
                                )}
                                {s.crew_size != null && (
                                    <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
                                        <Users size={13} />
                                        {s.crew_size} fő
                                    </span>
                                )}
                            </div>

                            <div className="sm:w-28 sm:text-right">
                                <RatingStars value={s.avg_rating} />
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Lapozó */}
            {subcontractors.data.length > 0 && subcontractors.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {subcontractors.links.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                preserveState
                                className={clsx(
                                    'rounded-md px-3 py-1.5 text-sm',
                                    link.active
                                        ? 'bg-accent font-medium text-white'
                                        : 'text-ink-soft hover:bg-white',
                                )}
                            >
                                {paginationLabel(link.label)}
                            </Link>
                        ) : (
                            <span key={i} className="px-3 py-1.5 text-sm text-ink-faint">
                                {paginationLabel(link.label)}
                            </span>
                        ),
                    )}
                </div>
            )}

            {modalOpen && (
                <SubcontractorModal
                    subcontractor={null}
                    trades={trades}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
