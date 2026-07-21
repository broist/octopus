import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Building2,
    Handshake,
    Mail,
    Phone,
    Plus,
    Search,
    Sparkles,
    User as UserIcon,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import PartnerModal from '@/Pages/CRM/Partials/PartnerModal';
import { usePageProps } from '@/hooks/usePageProps';
import type { Paginator, PartnerListItem } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    partners: Paginator<PartnerListItem>;
    filters: { search: string; role: string; type: string };
    roles: Record<string, string>;
    stats: {
        total: number;
        clients: number;
        suppliers: number;
        subcontractors: number;
        leads: number;
    };
}

const selectClass =
    'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

const ROLE_CHIP: Record<string, string> = {
    Megrendelő: 'bg-accent-50 text-accent-700',
    Beszállító: 'chip-amber',
    Alvállalkozó: 'bg-sidebar/10 text-sidebar',
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
    active,
    onClick,
}: {
    label: string;
    value: number;
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
            <div className="text-2xl font-semibold text-sidebar">{value}</div>
            <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
        </button>
    );
}

export default function Index() {
    const { partners, filters, roles, stats, auth } = usePageProps<IndexProps>();
    const canCreate = auth.permissions.includes('crm.create');

    const [modalOpen, setModalOpen] = useState(false);
    const [search, setSearch] = useState(filters.search);
    const [role, setRole] = useState(filters.role);
    const [type, setType] = useState(filters.type);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('crm.index'),
                {
                    search: search || undefined,
                    role: role || undefined,
                    type: type || undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, role, type]);

    const setRoleFilter = (r: string) => setRole((cur) => (cur === r ? '' : r));

    return (
        <>
            <Head title="Ügyfelek és partnerek" />

            <PageHeader
                title="Ügyfelek és partnerek"
                subtitle="A cég közös partner-adatbázisa: megrendelők, beszállítók és alvállalkozók."
                actions={
                    canCreate && (
                        <button className="btn-primary" onClick={() => setModalOpen(true)}>
                            <Plus size={16} />
                            Új partner
                        </button>
                    )
                }
            />

            {/* Statisztika-csempék (kattintva szűrnek) */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatTile
                    label="Összes partner"
                    value={stats.total}
                    active={role === '' && type === ''}
                    onClick={() => {
                        setRole('');
                        setType('');
                    }}
                />
                <StatTile
                    label="Megrendelő"
                    value={stats.clients}
                    active={role === 'is_client'}
                    onClick={() => setRoleFilter('is_client')}
                />
                <StatTile
                    label="Beszállító"
                    value={stats.suppliers}
                    active={role === 'is_supplier'}
                    onClick={() => setRoleFilter('is_supplier')}
                />
                <StatTile
                    label="Alvállalkozó"
                    value={stats.subcontractors}
                    active={role === 'is_subcontractor'}
                    onClick={() => setRoleFilter('is_subcontractor')}
                />
                <StatTile label="Ajánlatkérésből" value={stats.leads} />
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
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={`${selectClass} sm:w-44`}
                >
                    <option value="">Minden szerep</option>
                    {Object.entries(roles).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className={`${selectClass} sm:w-40`}
                >
                    <option value="">Cég és magánszemély</option>
                    <option value="company">Csak cég</option>
                    <option value="person">Csak magánszemély</option>
                </select>
            </div>

            {partners.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <Handshake size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">
                        Nincs a szűrésnek megfelelő partner
                    </h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search || filters.role || filters.type
                            ? 'Módosítsa a keresést vagy a szűrőket.'
                            : 'Vegye fel az első partnert — a projektek megrendelői is innen választhatók.'}
                    </p>
                    {canCreate && !filters.search && !filters.role && !filters.type && (
                        <button className="btn-primary mt-5" onClick={() => setModalOpen(true)}>
                            <Plus size={16} />
                            Első partner felvétele
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {partners.data.map((p) => (
                        <Link
                            key={p.id}
                            href={route('crm.show', p.id)}
                            className="flex flex-col gap-3 px-4 py-3 transition hover:bg-cream/50 sm:flex-row sm:items-center"
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span
                                    className={clsx(
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                                        p.is_company
                                            ? 'bg-accent-50 text-accent'
                                            : 'bg-sidebar/10 text-sidebar',
                                    )}
                                >
                                    {p.is_company ? <Building2 size={18} /> : <UserIcon size={18} />}
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-ink">
                                            {p.name}
                                        </span>
                                        {p.source === 'lead' && (
                                            <span
                                                className="chip inline-flex items-center gap-1 bg-accent-50 text-accent-700"
                                                title="Webes ajánlatkérésből érkezett"
                                            >
                                                <Sparkles size={11} />
                                                Ajánlatkérés
                                            </span>
                                        )}
                                    </div>
                                    {p.contact_name && (
                                        <div className="truncate text-xs text-ink-faint">
                                            {p.contact_name}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 sm:w-52">
                                {p.roles.map((r) => (
                                    <span
                                        key={r}
                                        className={clsx('chip', ROLE_CHIP[r] ?? 'chip-grey')}
                                    >
                                        {r}
                                    </span>
                                ))}
                            </div>

                            <div className="flex flex-col gap-0.5 text-xs text-ink-faint sm:w-56">
                                {p.email && (
                                    <span className="flex items-center gap-1 truncate">
                                        <Mail size={12} />
                                        {p.email}
                                    </span>
                                )}
                                {p.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone size={12} />
                                        {p.phone}
                                    </span>
                                )}
                            </div>

                            <div className="shrink-0 text-right text-xs text-ink-faint sm:w-20">
                                {p.projects_count > 0
                                    ? `${p.projects_count} projekt`
                                    : '–'}
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Lapozó */}
            {partners.data.length > 0 && partners.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {partners.links.map((link, i) =>
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
                <PartnerModal
                    partner={null}
                    roles={roles}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
