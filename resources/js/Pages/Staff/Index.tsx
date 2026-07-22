import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { PalmtreeIcon, Search, TriangleAlert, Users } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import { usePageProps } from '@/hooks/usePageProps';
import type { StaffListItem } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    staff: StaffListItem[];
    filters: { search: string };
    stats: { total: number; on_leave: number; expiring: number };
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'coral' | 'amber' }) {
    return (
        <div className="o-card px-4 py-3">
            <div
                className={clsx(
                    'text-2xl font-semibold',
                    tone === 'coral' && value > 0 ? 'text-coral' : tone === 'amber' && value > 0 ? 'text-amber-600' : 'text-sidebar',
                )}
            >
                {value}
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
        </div>
    );
}

export default function Index() {
    const { staff, filters, stats } = usePageProps<IndexProps>();

    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('staff.index'),
                { search: search || undefined },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    return (
        <>
            <Head title="Munkatársak / Erőforrások" />

            <PageHeader
                title="Munkatársak / Erőforrások"
                subtitle="Saját dolgozók: végzettségek lejárattal, munkaidő-nyilvántartás és szabadságok. A fiókok és szerepkörök a Felhasználók modulban kezelhetők."
            />

            <div className="mb-5 grid grid-cols-3 gap-3">
                <StatTile label="Aktív munkatárs" value={stats.total} />
                <StatTile label="Ma távol" value={stats.on_leave} tone="amber" />
                <StatTile label="Lejáró végzettség" value={stats.expiring} tone="coral" />
            </div>

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
                        placeholder="Keresés név, e-mail, beosztás…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
            </div>

            {staff.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <Users size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">
                        Nincs a keresésnek megfelelő munkatárs
                    </h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        Új munkatársat a Felhasználók / Jogosultságok modulban vehet fel.
                    </p>
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {staff.map((s) => (
                        <Link
                            key={s.id}
                            href={route('staff.show', s.id)}
                            className={clsx(
                                'flex flex-col gap-3 px-4 py-3 transition hover:bg-cream/50 sm:flex-row sm:items-center',
                                !s.is_active && 'opacity-60',
                            )}
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar/10 text-sm font-semibold text-sidebar">
                                    {s.initials}
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-ink">{s.name}</span>
                                        {!s.is_active && <span className="chip chip-grey">Inaktív</span>}
                                        {s.on_leave && (
                                            <span className="chip inline-flex items-center gap-1 bg-amber-100 text-amber-700">
                                                <PalmtreeIcon size={11} />
                                                Ma távol
                                            </span>
                                        )}
                                        {s.expiring_count > 0 && (
                                            <span
                                                className="chip inline-flex items-center gap-1 bg-coral/10 text-coral"
                                                title="Lejáró vagy lejárt végzettség"
                                            >
                                                <TriangleAlert size={11} />
                                                {s.expiring_count}
                                            </span>
                                        )}
                                    </div>
                                    <div className="truncate text-xs text-ink-faint">
                                        {s.job_title || s.email}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:w-56">
                                {s.role && <span className="chip chip-grey">{s.role}</span>}
                            </div>

                            <div className="hidden text-xs text-ink-faint sm:block sm:w-40 sm:text-right">
                                {s.phone || ''}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
