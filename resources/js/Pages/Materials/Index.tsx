import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    BookMarked,
    CalendarClock,
    CheckCircle2,
    Package,
    Pencil,
    Plus,
    Search,
    Trash2,
    Truck,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import ProcurementModal from '@/Pages/Materials/Partials/ProcurementModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type {
    MaterialOption,
    Option,
    Paginator,
    ProcurementItem,
    ProjectRef,
} from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    procurements: Paginator<ProcurementItem>;
    filters: { search: string; category: string; status: string; project: number | null };
    stats: { total: number; planned: number; ordered: number; received: number; value: number };
    materials: MaterialOption[];
    suppliers: Option[];
    projects: ProjectRef[];
    statuses: Record<string, string>;
    categories: Record<string, string>;
    units: Record<string, string>;
}

const selectClass =
    'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

const STATUS_CHIP: Record<string, string> = {
    tervezett: 'chip-amber',
    megrendelve: 'bg-sidebar/10 text-sidebar',
    beerkezett: 'chip-green',
};

const huf = new Intl.NumberFormat('hu-HU');
const qtyFmt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 3 });
const fmtHuf = (v: number | null) => (v == null ? '—' : `${huf.format(v)} Ft`);

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

export default function Index() {
    const {
        procurements, filters, stats, materials, suppliers, projects, statuses, categories, auth,
    } = usePageProps<IndexProps>();
    const canCreate = auth.permissions.includes('materials.create');
    const canEdit = auth.permissions.includes('materials.edit');
    const canDelete = auth.permissions.includes('materials.delete');

    const [modal, setModal] = useState<{ procurement: ProcurementItem | null } | null>(null);
    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(filters.category);
    const [status, setStatus] = useState(filters.status);
    const [project, setProject] = useState(filters.project ? String(filters.project) : '');
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('materials.index'),
                {
                    search: search || undefined,
                    category: category || undefined,
                    status: status || undefined,
                    project: project || undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, category, status, project]);

    const toggleStatus = (s: string) => setStatus((cur) => (cur === s ? '' : s));

    return (
        <>
            <Head title="Anyagok / Készlet" />

            <PageHeader
                title="Anyagok / Készlet"
                subtitle="Projekthez kötött beszerzés-követés: mit, mennyit, kitől és milyen státuszban rendeltünk."
                actions={
                    <>
                        <Link href={route('materials.catalog')} className="btn-ghost">
                            <BookMarked size={16} />
                            Anyagtörzs
                        </Link>
                        {canCreate && (
                            <button className="btn-primary" onClick={() => setModal({ procurement: null })}>
                                <Plus size={16} />
                                Új beszerzés
                            </button>
                        )}
                    </>
                }
            />

            {/* Statisztika-csempék */}
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                    label="Összes beszerzés"
                    value={stats.total}
                    active={status === ''}
                    onClick={() => setStatus('')}
                />
                <StatTile
                    label="Tervezett (hiány)"
                    value={stats.planned}
                    tone="coral"
                    active={status === 'tervezett'}
                    onClick={() => toggleStatus('tervezett')}
                />
                <StatTile
                    label="Megrendelve"
                    value={stats.ordered}
                    active={status === 'megrendelve'}
                    onClick={() => toggleStatus('megrendelve')}
                />
                <StatTile
                    label="Beérkezett"
                    value={stats.received}
                    active={status === 'beerkezett'}
                    onClick={() => toggleStatus('beerkezett')}
                />
            </div>

            {/* Összérték */}
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-sm">
                <Truck size={16} className="text-ink-faint" />
                <span className="text-ink-soft">
                    Beszerzés összértéke (megrendelt + beérkezett
                    {filters.project ? ', a szűrt projektre' : ''}):
                </span>
                <span className="font-semibold text-sidebar">{fmtHuf(stats.value)}</span>
            </div>

            {/* Szűrők */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Keresés anyagnév, cikkszám…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
                <select value={project} onChange={(e) => setProject(e.target.value)} className={`${selectClass} sm:w-56`}>
                    <option value="">Minden projekt</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.code} – {p.name}
                        </option>
                    ))}
                </select>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${selectClass} sm:w-52`}>
                    <option value="">Minden kategória</option>
                    {Object.entries(categories).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            {procurements.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <Package size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs a szűrésnek megfelelő beszerzés</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search || filters.category || filters.status || filters.project
                            ? 'Módosítsa a keresést vagy a szűrőket.'
                            : 'Rögzítse az első beszerzést — projekt, anyag, mennyiség, ár és beszállító.'}
                    </p>
                    {canCreate && (
                        <button className="btn-primary mt-5" onClick={() => setModal({ procurement: null })}>
                            <Plus size={16} />
                            Új beszerzés
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {procurements.data.map((p) => (
                        <div key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent">
                                    <Package size={18} />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="truncate text-sm font-medium text-ink">
                                            {p.material?.name ?? '—'}
                                        </span>
                                        <span className="text-xs text-ink-soft">
                                            {qtyFmt.format(p.quantity)} {p.material?.unit_label}
                                        </span>
                                    </div>
                                    <div className="truncate text-xs text-ink-faint">
                                        {p.project && (
                                            <Link
                                                href={route('projects.show', p.project.id)}
                                                className="font-mono hover:text-accent"
                                            >
                                                {p.project.code}
                                            </Link>
                                        )}
                                        {p.supplier_name && <span> · {p.supplier_name}</span>}
                                        {p.expected_on && p.status !== 'beerkezett' && (
                                            <span className="ml-1 inline-flex items-center gap-1">
                                                <CalendarClock size={11} />
                                                {fmtDate(p.expected_on)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 sm:w-auto sm:justify-end">
                                <span className="w-24 text-right text-sm font-medium text-ink-soft">
                                    {fmtHuf(p.line_value)}
                                </span>
                                <span className={clsx('chip w-24 justify-center', STATUS_CHIP[p.status] ?? 'chip-grey')}>
                                    {p.status_label}
                                </span>
                                <div className="flex items-center gap-1">
                                    {canEdit && p.status !== 'beerkezett' && (
                                        <button
                                            onClick={() =>
                                                router.post(route('materials.receive', p.id), {}, { preserveScroll: true })
                                            }
                                            className="btn-ghost !p-2 text-accent hover:bg-accent-50"
                                            title="Beérkezettként jelöl"
                                        >
                                            <CheckCircle2 size={16} />
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button
                                            onClick={() => setModal({ procurement: p })}
                                            className="btn-ghost !p-2"
                                            title="Szerkesztés"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Törli ezt a beszerzést?')) {
                                                    router.delete(route('materials.destroy', p.id), {
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
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lapozó */}
            {procurements.data.length > 0 && procurements.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {procurements.links.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                preserveState
                                className={clsx(
                                    'rounded-md px-3 py-1.5 text-sm',
                                    link.active ? 'bg-accent font-medium text-white' : 'text-ink-soft hover:bg-white',
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

            {modal && (
                <ProcurementModal
                    procurement={modal.procurement}
                    materials={materials}
                    suppliers={suppliers}
                    projects={projects}
                    statuses={statuses}
                    presetProjectId={filters.project}
                    canDelete={canDelete}
                    onClose={() => setModal(null)}
                    onDelete={() => {
                        const p = modal.procurement;
                        setModal(null);
                        if (p && confirm('Törli ezt a beszerzést?')) {
                            router.delete(route('materials.destroy', p.id), { preserveScroll: true });
                        }
                    }}
                />
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
