import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Plus, Search, FolderKanban, Layers, ListTree } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StatusChip, { SlippingChip } from '@/Components/StatusChip';
import ProgressBar from '@/Components/ProgressBar';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { Paginator, ProjectListItem } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    projects: Paginator<ProjectListItem>;
    filters: { status: string; search: string };
    statuses: Record<string, string>;
}

function paginationLabel(label: string): string {
    return label
        .replace('&laquo;', '«')
        .replace('&raquo;', '»')
        .replace('Previous', 'Előző')
        .replace('Next', 'Következő');
}

export default function Index() {
    const { projects, filters, statuses, auth } = usePageProps<IndexProps>();
    const canCreate = auth.permissions.includes('projects.create');

    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState(filters.status);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('projects.index'),
                { search: search || undefined, status: status || undefined },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, status]);

    return (
        <>
            <Head title="Projektek" />

            <PageHeader
                title="Projektek / Munkák"
                subtitle="A cég futó és lezárt munkái egy helyen."
                actions={
                    canCreate && (
                        <Link href={route('projects.create')} className="btn-primary">
                            <Plus size={16} />
                            Új projekt
                        </Link>
                    )
                }
            />

            {/* Szűrők */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Keresés névre, kódra, megrendelőre…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30 sm:w-52"
                >
                    <option value="">Minden státusz</option>
                    {Object.entries(statuses).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            {projects.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <FolderKanban size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">
                        Nincs a szűrésnek megfelelő projekt
                    </h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search || filters.status
                            ? 'Próbáljon másik keresőszót vagy státuszt.'
                            : 'Hozza létre az első projektet, és innen követheti a teljes kivitelezést.'}
                    </p>
                    {canCreate && !filters.search && !filters.status && (
                        <Link href={route('projects.create')} className="btn-primary mt-5">
                            <Plus size={16} />
                            Első projekt létrehozása
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {projects.data.map((p) => (
                        <Link
                            key={p.id}
                            href={route('projects.show', p.id)}
                            className="o-card group flex flex-col p-5 transition hover:border-accent/40 hover:shadow-md"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs text-ink-faint">{p.code}</span>
                                <span className="flex items-center gap-1.5">
                                    {p.is_slipping && <SlippingChip />}
                                    <StatusChip status={p.status} />
                                </span>
                            </div>

                            <h3 className="mt-2 text-base font-semibold text-sidebar group-hover:text-accent-700">
                                {p.name}
                            </h3>
                            <p className="mt-0.5 text-sm text-ink-soft">
                                {p.client_name ?? 'Nincs megrendelő megadva'}
                            </p>

                            <div className="mt-4 flex items-center gap-2">
                                <ProgressBar value={p.progress} warn={p.is_slipping} className="flex-1" />
                                <span className="w-10 text-right text-xs font-medium text-ink-soft">
                                    {p.progress}%
                                </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-faint">
                                <span>
                                    {fmtDate(p.starts_on)} – {fmtDate(p.ends_on)}
                                </span>
                                <span className="flex items-center gap-3">
                                    {p.subprojects_count > 0 && (
                                        <span className="flex items-center gap-1">
                                            <ListTree size={13} />
                                            {p.subprojects_count}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Layers size={13} />
                                        {p.phases_count}
                                    </span>
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Lapozó */}
            {projects.data.length > 0 && projects.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {projects.links.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                preserveState
                                className={`rounded-md px-3 py-1.5 text-sm ${
                                    link.active
                                        ? 'bg-accent font-medium text-white'
                                        : 'text-ink-soft hover:bg-white'
                                }`}
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
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
