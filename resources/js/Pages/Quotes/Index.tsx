import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    CheckCircle2,
    FileSpreadsheet,
    FileText,
    Plus,
    Search,
    Sparkles,
    Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtHuf } from '@/lib/quote';
import { fmtDateTime } from '@/lib/format';
import type { QuoteListItem } from '@/types/quote';

interface IndexProps extends Record<string, unknown> {
    quotes: QuoteListItem[];
    filters: { search: string };
    meta: { projectName?: string; itemCount?: number; categoryCount?: number };
}

export default function Index() {
    const { quotes, filters, meta, auth } = usePageProps<IndexProps>();
    const canCreate = auth.permissions.includes('ajanlatok.create');
    const canDelete = auth.permissions.includes('ajanlatok.delete');

    const [search, setSearch] = useState(filters.search);
    const [creating, setCreating] = useState(false);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('ajanlatok.index'),
                { search: search || undefined },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const create = (template: 'blank' | 'sample') => {
        setCreating(true);
        router.post(
            route('ajanlatok.store'),
            { template },
            { onFinish: () => setCreating(false) },
        );
    };

    const destroy = (q: QuoteListItem) => {
        if (confirm(`Biztosan törli a(z) „${q.project_name}” árajánlatot?`)) {
            router.delete(route('ajanlatok.destroy', q.id), { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title="Ajánlatok" />

            <PageHeader
                title="Ajánlatkérő"
                subtitle="Árajánlatok készítése az AcuWall munkanem- és tételsablonból, ügyfél-PDF-fel."
                actions={
                    canCreate && (
                        <div className="flex items-center gap-2">
                            <button
                                className="btn-ghost"
                                disabled={creating}
                                onClick={() => create('sample')}
                                title="Mintaárazott projekt betöltése"
                            >
                                <Sparkles size={16} />
                                Minta
                            </button>
                            <button
                                className="btn-primary"
                                disabled={creating}
                                onClick={() => create('blank')}
                            >
                                <Plus size={16} />
                                Új árajánlat
                            </button>
                        </div>
                    )
                }
            />

            {/* Sablon-infó */}
            {meta.itemCount ? (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-accent-50/50 px-4 py-2.5 text-sm text-ink-soft">
                    <FileSpreadsheet size={16} className="text-accent" />
                    Beépített sablon: <span className="font-medium text-ink">{meta.categoryCount}</span> munkanem,{' '}
                    <span className="font-medium text-ink">{meta.itemCount}</span> tétel a TERC-exportból.
                </div>
            ) : null}

            {/* Kereső */}
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
                        placeholder="Keresés projekt, ügyfél, ajánlatszám…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
                <span className="text-sm text-ink-faint sm:ml-auto">{quotes.length} árajánlat</span>
            </div>

            {quotes.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <FileSpreadsheet size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Még nincs árajánlat</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search
                            ? 'A keresésnek megfelelő árajánlat nincs.'
                            : 'Hozza létre az első árajánlatot a beépített munkanem-sablonból.'}
                    </p>
                    {canCreate && !filters.search && (
                        <button className="btn-primary mt-5" disabled={creating} onClick={() => create('blank')}>
                            <Plus size={16} />
                            Első árajánlat
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {quotes.map((q) => (
                        <div key={q.id} className="flex items-center gap-3 px-4 py-3">
                            <Link
                                href={route('ajanlatok.show', q.id)}
                                className="flex min-w-0 flex-1 items-center gap-3"
                            >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent">
                                    <FileText size={18} />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-ink">
                                            {q.project_name}
                                        </span>
                                        {q.status === 'jóváhagyva' ? (
                                            <span className="chip inline-flex items-center gap-1 bg-accent-50 text-accent-700">
                                                <CheckCircle2 size={11} />
                                                Jóváhagyva · v{q.version}
                                            </span>
                                        ) : (
                                            <span className="chip chip-grey">Piszkozat</span>
                                        )}
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-faint">
                                        {q.quote_number && (
                                            <span className="font-mono">{q.quote_number}</span>
                                        )}
                                        {q.client_name && <span className="truncate">{q.client_name}</span>}
                                        {q.location && <span>{q.location}</span>}
                                    </div>
                                </div>
                            </Link>

                            <div className="hidden text-right sm:block">
                                <div className="text-sm font-semibold text-ink">{fmtHuf(q.net_offer)}</div>
                                <div className="text-xs text-ink-faint">nettó</div>
                            </div>

                            <div className="hidden w-28 text-right text-xs text-ink-faint md:block">
                                {fmtDateTime(q.updated_at)}
                            </div>

                            {canDelete && (
                                <button
                                    type="button"
                                    onClick={() => destroy(q)}
                                    className="rounded-lg p-2 text-ink-soft hover:bg-cream hover:text-coral"
                                    title="Törlés"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
