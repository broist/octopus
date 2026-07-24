import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Boxes, Hash, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import MaterialModal from '@/Pages/Materials/Partials/MaterialModal';
import { usePageProps } from '@/hooks/usePageProps';
import type { MaterialCatalogItem, Paginator } from '@/types/models';

interface CatalogProps extends Record<string, unknown> {
    materials: Paginator<MaterialCatalogItem>;
    filters: { search: string; category: string };
    categories: Record<string, string>;
    units: Record<string, string>;
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

export default function Catalog() {
    const { materials, filters, categories, units, auth } = usePageProps<CatalogProps>();
    const canCreate = auth.permissions.includes('materials.create');
    const canEdit = auth.permissions.includes('materials.edit');
    const canDelete = auth.permissions.includes('materials.delete');

    const [modal, setModal] = useState<{ material: MaterialCatalogItem | null } | null>(null);
    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(filters.category);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('materials.catalog'),
                { search: search || undefined, category: category || undefined },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, category]);

    return (
        <>
            <Head title="Anyagtörzs" />

            <Link
                href={route('materials.index')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza a beszerzésekhez
            </Link>

            <PageHeader
                title="Anyagtörzs"
                subtitle="A rendelhető anyagok katalógusa: név, kategória, mértékegység, cikkszám."
                actions={
                    canCreate && (
                        <button className="btn-primary" onClick={() => setModal({ material: null })}>
                            <Plus size={16} />
                            Új anyag
                        </button>
                    )
                }
            />

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
                        placeholder="Keresés név, cikkszám…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${selectClass} sm:w-56`}>
                    <option value="">Minden kategória</option>
                    {Object.entries(categories).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            {materials.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <Boxes size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Üres az anyagtörzs</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search || filters.category
                            ? 'Módosítsa a keresést vagy a kategória-szűrőt.'
                            : 'Vegye fel az első anyagot — utána tud rá beszerzést rögzíteni.'}
                    </p>
                    {canCreate && !filters.search && !filters.category && (
                        <button className="btn-primary mt-5" onClick={() => setModal({ material: null })}>
                            <Plus size={16} />
                            Első anyag felvétele
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {materials.data.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar/10 text-sidebar">
                                <Boxes size={18} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                                    {m.category_label && (
                                        <span className="chip bg-sidebar/10 text-sidebar">{m.category_label}</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 text-xs text-ink-faint">
                                    <span>Egység: {m.unit_label}</span>
                                    {m.sku && (
                                        <span className="inline-flex items-center gap-1">
                                            <Hash size={11} />
                                            {m.sku}
                                        </span>
                                    )}
                                    <span>{m.procurements_count} beszerzés</span>
                                </div>
                            </div>
                            {canEdit && (
                                <button
                                    onClick={() => setModal({ material: m })}
                                    className="btn-ghost !p-2"
                                    title="Szerkesztés"
                                >
                                    <Pencil size={15} />
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={() => {
                                        if (confirm(`Törli az anyagtörzsből: ${m.name}?`)) {
                                            router.delete(route('materials.catalog.destroy', m.id), {
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
                </div>
            )}

            {materials.data.length > 0 && materials.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {materials.links.map((link, i) =>
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
                <MaterialModal
                    material={modal.material}
                    categories={categories}
                    units={units}
                    canDelete={canDelete}
                    onClose={() => setModal(null)}
                    onDelete={() => {
                        const m = modal.material;
                        setModal(null);
                        if (m && confirm(`Törli az anyagtörzsből: ${m.name}?`)) {
                            router.delete(route('materials.catalog.destroy', m.id), { preserveScroll: true });
                        }
                    }}
                />
            )}
        </>
    );
}

Catalog.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
