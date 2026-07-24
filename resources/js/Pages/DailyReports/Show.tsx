import { ReactNode, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CloudOff,
    HardHat,
    Hammer,
    Package,
    Pencil,
    RefreshCw,
    Trash2,
    Truck,
    User as UserIcon,
    Users,
    X,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import { WeatherCard } from '@/Pages/DailyReports/Partials/Weather';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { DailyReportDetail, DailyReportPhoto } from '@/types/models';

interface ShowProps extends Record<string, unknown> {
    report: DailyReportDetail;
    canEdit: boolean;
    canDelete: boolean;
}

function Section({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: typeof Users;
    children: ReactNode;
}) {
    return (
        <div className="o-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar">
                <Icon size={15} className="text-ink-faint" />
                {title}
            </h2>
            {children}
        </div>
    );
}

export default function Show() {
    const { report, canEdit, canDelete } = usePageProps<ShowProps>();
    const [lightbox, setLightbox] = useState<DailyReportPhoto | null>(null);

    const remove = () => {
        if (confirm('Biztosan törli ezt a napi jelentést?')) {
            router.delete(route('daily-reports.destroy', report.id));
        }
    };

    return (
        <>
            <Head title={`Napi jelentés – ${fmtDate(report.report_date)}`} />

            <PageHeader
                title={fmtDate(report.report_date)}
                subtitle={
                    report.project ? `${report.project.code} – ${report.project.name}` : 'Napi jelentés'
                }
                actions={
                    <>
                        <Link href={route('daily-reports.index')} className="btn-ghost">
                            <ArrowLeft size={16} />
                            Lista
                        </Link>
                        {canEdit && (
                            <Link href={route('daily-reports.edit', report.id)} className="btn-primary">
                                <Pencil size={15} />
                                Szerkesztés
                            </Link>
                        )}
                        {canDelete && (
                            <button
                                onClick={remove}
                                className="btn inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                title="Törlés"
                            >
                                <Trash2 size={15} />
                            </button>
                        )}
                    </>
                }
            />

            {/* Meta sor */}
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                <span className="inline-flex items-center gap-1">
                    <UserIcon size={13} />
                    {report.creator_name ?? '–'}
                </span>
                {report.project && (
                    <Link href={route('projects.show', report.project.id)} className="font-mono text-accent hover:underline">
                        {report.project.code}
                    </Link>
                )}
                <span className="inline-flex items-center gap-1" title="Összlétszám">
                    <Users size={13} />
                    {report.total_headcount} fő
                </span>
                {report.created_at && <span className="text-ink-faint">Rögzítve: {fmtDateTime(report.created_at)}</span>}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Bal / fő oszlop */}
                <div className="space-y-4 lg:col-span-2">
                    <Section title="Elvégzett munka" icon={Hammer}>
                        <p className="whitespace-pre-wrap text-sm text-ink">{report.work_done}</p>
                    </Section>

                    {report.obstacles && (
                        <div className="o-card border-l-4 border-l-coral p-5">
                            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-coral">
                                <AlertTriangle size={15} />
                                Akadályok / események
                            </h2>
                            <p className="whitespace-pre-wrap text-sm text-ink">{report.obstacles}</p>
                        </div>
                    )}

                    {(report.material_movement || report.machine_movement) && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {report.material_movement && (
                                <Section title="Anyagmozgás" icon={Package}>
                                    <p className="whitespace-pre-wrap text-sm text-ink">{report.material_movement}</p>
                                </Section>
                            )}
                            {report.machine_movement && (
                                <Section title="Gépmozgás" icon={Truck}>
                                    <p className="whitespace-pre-wrap text-sm text-ink">{report.machine_movement}</p>
                                </Section>
                            )}
                        </div>
                    )}

                    {/* Fotók */}
                    {report.photos.length > 0 && (
                        <Section title={`Helyszíni fotók (${report.photos.length})`} icon={HardHat}>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {report.photos.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setLightbox(p)}
                                        className="aspect-square overflow-hidden rounded-lg border border-line transition hover:opacity-90"
                                        title={p.name}
                                    >
                                        {p.is_image ? (
                                            <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center bg-cream p-2 text-center text-[10px] text-ink-faint">
                                                {p.name}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>

                {/* Jobb oszlop */}
                <div className="space-y-4">
                    {/* Időjárás */}
                    {report.weather ? (
                        <WeatherCard weather={report.weather} />
                    ) : (
                        <div className="o-card flex items-center gap-3 p-4 text-sm text-ink-soft">
                            <CloudOff size={18} className="text-ink-faint" />
                            <div className="flex-1">
                                <div>Időjárás nem elérhető</div>
                                {canEdit && (
                                    <button
                                        onClick={() => router.post(route('daily-reports.weather', report.id), {}, { preserveScroll: true })}
                                        className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                                    >
                                        <RefreshCw size={12} />
                                        Lekérés újra
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Létszám */}
                    <Section title="Létszám" icon={Users}>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-ink-soft">Saját dolgozók</span>
                                <span className="font-semibold text-ink">{report.own_headcount} fő</span>
                            </div>
                            {report.workers.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {report.workers.map((w) => (
                                        <span key={w.id} className="chip chip-grey">
                                            {w.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {report.crews.length > 0 && (
                                <div className="border-t border-line pt-3">
                                    <div className="mb-2 text-xs font-medium text-ink-soft">Alvállalkozói brigádok</div>
                                    <ul className="space-y-1.5">
                                        {report.crews.map((c) => (
                                            <li key={c.id} className="flex items-center justify-between gap-2">
                                                <span className="min-w-0">
                                                    <span className="truncate text-ink">{c.subcontractor_name}</span>
                                                    {c.note && (
                                                        <span className="block truncate text-xs text-ink-faint">{c.note}</span>
                                                    )}
                                                </span>
                                                <span className="shrink-0 font-medium text-ink-soft">{c.headcount} fő</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex items-center justify-between border-t border-line pt-3">
                                <span className="font-medium text-sidebar">Összesen</span>
                                <span className="font-semibold text-sidebar">{report.total_headcount} fő</span>
                            </div>
                        </div>
                    </Section>
                </div>
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setLightbox(null)}
                >
                    <button
                        type="button"
                        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                        onClick={() => setLightbox(null)}
                    >
                        <X size={20} />
                    </button>
                    <img
                        src={lightbox.url}
                        alt={lightbox.name}
                        className="max-h-full max-w-full rounded-lg object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}

Show.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
