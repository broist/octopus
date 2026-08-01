import { ReactNode } from 'react';
import { Head, Link } from '@inertiajs/react';
import { CalendarRange, FileSpreadsheet, FolderOpen, Images, MapPin, Phone } from 'lucide-react';
import PortalLayout from '@/Layouts/PortalLayout';
import ProgressBar from '@/Components/ProgressBar';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { PortalPartner, PortalProjectRow } from '@/types/portal';

interface IndexProps extends Record<string, unknown> {
    partner: PortalPartner;
    projects: PortalProjectRow[];
}

function Badge({ icon: Icon, count, label }: { icon: typeof FolderOpen; count: number; label: string }) {
    if (count === 0) {
        return null;
    }

    return (
        <span className="chip chip-grey" title={label}>
            <Icon size={12} />
            {count} {label}
        </span>
    );
}

export default function Index() {
    const { partner, projects } = usePageProps<IndexProps>();

    return (
        <>
            <Head title="Projektjeim" />

            <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight text-sidebar">
                    Üdvözöljük, {partner.name}!
                </h1>
                <p className="mt-1 text-sm text-ink-soft">
                    Itt követheti a munkái állását, töltheti le a dokumentumokat és nyilatkozhat
                    az árajánlatokról.
                </p>
            </div>

            {projects.length === 0 ? (
                <div className="o-card px-6 py-14 text-center">
                    <h2 className="text-base font-semibold text-sidebar">
                        Még nincs megosztott projekt
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                        Amint kapcsolattartója megosztja Önnel az első munkát, az itt fog
                        megjelenni. Addig is bátran keresse őt kérdéseivel.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {projects.map((p) => (
                        <Link
                            key={p.id}
                            href={route('ugyfel.projekt', p.id)}
                            className="o-card block p-5 transition hover:border-accent/40"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs text-ink-faint">
                                            {p.code}
                                        </span>
                                        <span className="chip chip-green">{p.status_label}</span>
                                    </div>
                                    <h2 className="mt-1 text-lg font-semibold text-sidebar">
                                        {p.name}
                                    </h2>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge icon={FolderOpen} count={p.documents_count} label="dokumentum" />
                                    <Badge icon={Images} count={p.reports_count} label="haladás-bejegyzés" />
                                    {p.open_quotes_count > 0 && (
                                        <span className="chip chip-amber">
                                            <FileSpreadsheet size={12} />
                                            {p.open_quotes_count} ajánlat vár válaszra
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                                <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                                    Készültség
                                </span>
                                <ProgressBar value={p.progress} className="flex-1" />
                                <span className="text-sm font-semibold text-sidebar">
                                    {p.progress}%
                                </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-sm text-ink-soft">
                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarRange size={15} className="text-ink-faint" />
                                    {fmtDate(p.starts_on)} – {fmtDate(p.ends_on)}
                                </span>
                                {p.location && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin size={15} className="text-ink-faint" />
                                        {p.location}
                                    </span>
                                )}
                                {p.manager && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Phone size={15} className="text-ink-faint" />
                                        {p.manager.name}
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <PortalLayout>{page}</PortalLayout>;
