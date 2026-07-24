import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarClock,
    MapPin,
    Plus,
    Search,
    Truck,
    User as UserIcon,
    Wrench,
    TriangleAlert,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import MachineModal from '@/Pages/Machines/Partials/MachineModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { CertStatus, MachineListItem, Option, Paginator } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    machines: Paginator<MachineListItem>;
    filters: { search: string; kind: string; status: string };
    kinds: Record<string, string>;
    statuses: Record<string, string>;
    ownership: Record<string, string>;
    responsible_options: Option[];
    stats: { total: number; booked_today: number; in_service: number; expiring: number };
}

const selectClass =
    'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

const STATUS_CHIP: Record<string, string> = {
    szabad: 'chip-green',
    hasznalatban: 'bg-sidebar/10 text-sidebar',
    szervizben: 'chip-amber',
};

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

/** A gép „figyelmet igényel", ha bármelyik lejárat közel/lejárt. */
function expiryTone(a: CertStatus, b: CertStatus): 'expired' | 'soon' | null {
    if (a === 'expired' || b === 'expired') return 'expired';
    if (a === 'soon' || b === 'soon') return 'soon';
    return null;
}

export default function Index() {
    const { machines, filters, kinds, statuses, ownership, responsible_options, stats, auth } =
        usePageProps<IndexProps>();
    const canCreate = auth.permissions.includes('machines.create');

    const [modalOpen, setModalOpen] = useState(false);
    const [search, setSearch] = useState(filters.search);
    const [kind, setKind] = useState(filters.kind);
    const [status, setStatus] = useState(filters.status);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('machines.index'),
                { search: search || undefined, kind: kind || undefined, status: status || undefined },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, kind, status]);

    return (
        <>
            <Head title="Gépek és eszközök" />

            <PageHeader
                title="Gépek és eszközök"
                subtitle="A cég géppark-nyilvántartása: státusz, hely, karbantartás és műszaki vizsga lejárattal, foglalások."
                actions={
                    canCreate && (
                        <button className="btn-primary" onClick={() => setModalOpen(true)}>
                            <Plus size={16} />
                            Új gép / eszköz
                        </button>
                    )
                }
            />

            {/* Statisztika-csempék */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Összes gép / eszköz" value={stats.total} />
                <StatTile label="Ma foglalt / kint" value={stats.booked_today} />
                <StatTile label="Szervizben" value={stats.in_service} />
                <StatTile label="Lejáró szerviz / vizsga" value={stats.expiring} tone="coral" />
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
                        placeholder="Keresés név, azonosító, hely…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
                <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className={`${selectClass} sm:w-56`}
                >
                    <option value="">Minden kategória</option>
                    {Object.entries(kinds).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`${selectClass} sm:w-44`}
                >
                    <option value="">Minden státusz</option>
                    {Object.entries(statuses).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            {machines.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <Truck size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">
                        Nincs a szűrésnek megfelelő gép
                    </h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search || filters.kind || filters.status
                            ? 'Módosítsa a keresést vagy a szűrőket.'
                            : 'Vegye fel az első gépet — státusz, karbantartás, vizsga és foglalás is rögzíthető.'}
                    </p>
                    {canCreate && !filters.search && !filters.kind && !filters.status && (
                        <button className="btn-primary mt-5" onClick={() => setModalOpen(true)}>
                            <Plus size={16} />
                            Első gép felvétele
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {machines.data.map((m) => {
                        const tone = expiryTone(m.service_status, m.inspection_status);
                        return (
                            <Link
                                key={m.id}
                                href={route('machines.show', m.id)}
                                className="flex flex-col gap-3 px-4 py-3 transition hover:bg-cream/50 sm:flex-row sm:items-center"
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent">
                                        <Truck size={18} />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium text-ink">
                                                {m.name}
                                            </span>
                                            {tone && (
                                                <span
                                                    className={clsx(
                                                        'chip inline-flex items-center gap-1',
                                                        tone === 'expired'
                                                            ? 'bg-coral/10 text-coral'
                                                            : 'chip-amber',
                                                    )}
                                                    title={
                                                        tone === 'expired'
                                                            ? 'Lejárt szerviz vagy műszaki vizsga'
                                                            : 'Hamarosan esedékes szerviz vagy vizsga'
                                                    }
                                                >
                                                    <TriangleAlert size={11} />
                                                    {tone === 'expired' ? 'Lejárt' : 'Esedékes'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="truncate text-xs text-ink-faint">
                                            {[m.kind_label, m.identifier].filter(Boolean).join(' · ') || '—'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:w-72">
                                    {m.location && (
                                        <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
                                            <MapPin size={13} />
                                            {m.location}
                                        </span>
                                    )}
                                    {m.responsible_name && (
                                        <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
                                            <UserIcon size={13} />
                                            {m.responsible_name}
                                        </span>
                                    )}
                                    {m.next_service_on && (
                                        <span
                                            className={clsx(
                                                'inline-flex items-center gap-1 text-xs',
                                                m.service_status === 'expired'
                                                    ? 'text-coral'
                                                    : m.service_status === 'soon'
                                                      ? 'text-[#8a5e17]'
                                                      : 'text-ink-faint',
                                            )}
                                            title="Következő szerviz"
                                        >
                                            <Wrench size={13} />
                                            {fmtDate(m.next_service_on)}
                                        </span>
                                    )}
                                    {m.inspection_valid_until && (
                                        <span
                                            className={clsx(
                                                'inline-flex items-center gap-1 text-xs',
                                                m.inspection_status === 'expired'
                                                    ? 'text-coral'
                                                    : m.inspection_status === 'soon'
                                                      ? 'text-[#8a5e17]'
                                                      : 'text-ink-faint',
                                            )}
                                            title="Műszaki vizsga érvényessége"
                                        >
                                            <CalendarClock size={13} />
                                            {fmtDate(m.inspection_valid_until)}
                                        </span>
                                    )}
                                </div>

                                <div className="sm:w-32 sm:text-right">
                                    <span className={clsx('chip', STATUS_CHIP[m.status] ?? 'chip-grey')}>
                                        {m.status_label}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Lapozó */}
            {machines.data.length > 0 && machines.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {machines.links.map((link, i) =>
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
                <MachineModal
                    machine={null}
                    kinds={kinds}
                    statuses={statuses}
                    ownership={ownership}
                    responsibleOptions={responsible_options}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
