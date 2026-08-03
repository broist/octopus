import { ReactNode, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import {
    ArrowLeft,
    CalendarRange,
    CheckCircle2,
    Download,
    Eye,
    Flag,
    Mail,
    MapPin,
    Phone,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import PortalLayout from '@/Layouts/PortalLayout';
import ProgressBar from '@/Components/ProgressBar';
import QuoteResponse from '@/Pages/Portal/Partials/QuoteResponse';
import { WeatherChip } from '@/Pages/DailyReports/Partials/Weather';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtBytes, fmtDate } from '@/lib/format';
import { fileIcon } from '@/lib/documents';
import type {
    PortalDocument,
    PortalPartner,
    PortalPhase,
    PortalProject,
    PortalQuote,
    PortalReport,
} from '@/types/portal';

interface ProjectProps extends Record<string, unknown> {
    partner: PortalPartner;
    project: PortalProject;
    phases: PortalPhase[];
    documents: PortalDocument[];
    reports: PortalReport[];
    quotes: PortalQuote[];
}

type Tab = 'attekintes' | 'dokumentumok' | 'haladas' | 'ajanlatok';

export default function ProjectPage() {
    const { project, phases, documents, reports, quotes } = usePageProps<ProjectProps>();
    const [tab, setTab] = useState<Tab>('attekintes');
    const [lightbox, setLightbox] = useState<{ url: string; filename: string } | null>(null);

    const openQuotes = quotes.filter((q) => q.is_final && !q.response).length;

    const tabs: { key: Tab; label: string; badge?: number }[] = [
        { key: 'attekintes', label: 'Áttekintés' },
        { key: 'dokumentumok', label: 'Dokumentumok', badge: documents.length },
        { key: 'haladas', label: 'Haladás', badge: reports.length },
        { key: 'ajanlatok', label: 'Árajánlatok', badge: quotes.length },
    ];

    return (
        <>
            <Head title={project.name} />

            <Link
                href={route('ugyfel.index')}
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza a projektjeimhez
            </Link>

            <div className="mb-5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-faint">{project.code}</span>
                    <span className="chip chip-green">{project.status_label}</span>
                    {openQuotes > 0 && (
                        <span className="chip chip-amber">
                            {openQuotes} árajánlat vár válaszra
                        </span>
                    )}
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-sidebar">
                    {project.name}
                </h1>
            </div>

            {/* Törzsadatok + készültség */}
            <div className="o-card mb-5 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-2.5">
                        <CalendarRange size={16} className="mt-0.5 shrink-0 text-ink-faint" />
                        <div>
                            <div className="text-xs text-ink-faint">Tervezett időtartam</div>
                            <div className="text-sm font-medium text-ink">
                                {fmtDate(project.starts_on)} – {fmtDate(project.ends_on)}
                            </div>
                        </div>
                    </div>
                    {project.location && (
                        <div className="flex items-start gap-2.5">
                            <MapPin size={16} className="mt-0.5 shrink-0 text-ink-faint" />
                            <div>
                                <div className="text-xs text-ink-faint">Helyszín</div>
                                <div className="text-sm font-medium text-ink">{project.location}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                        Készültség
                    </span>
                    <ProgressBar value={project.progress} className="flex-1" />
                    <span className="text-sm font-semibold text-sidebar">{project.progress}%</span>
                </div>
            </div>

            {/* Kapcsolattartó */}
            {project.manager && (
                <div className="o-card mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                    <div>
                        <div className="text-xs text-ink-faint">Kapcsolattartó</div>
                        <div className="text-sm font-semibold text-sidebar">
                            {project.manager.name}
                            {project.manager.job_title && (
                                <span className="ml-1.5 text-xs font-normal text-ink-faint">
                                    {project.manager.job_title}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {project.manager.email && (
                            <a
                                href={`mailto:${project.manager.email}`}
                                className="inline-flex items-center gap-1.5 text-accent hover:underline"
                            >
                                <Mail size={15} />
                                {project.manager.email}
                            </a>
                        )}
                        {project.manager.phone && (
                            <a
                                href={`tel:${project.manager.phone}`}
                                className="inline-flex items-center gap-1.5 text-accent hover:underline"
                            >
                                <Phone size={15} />
                                {project.manager.phone}
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Fülek */}
            <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={clsx(
                            '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition',
                            tab === t.key
                                ? 'border-accent text-accent-700'
                                : 'border-transparent text-ink-soft hover:text-ink',
                        )}
                    >
                        {t.label}
                        {t.badge ? (
                            <span className="ml-1.5 text-xs text-ink-faint">{t.badge}</span>
                        ) : null}
                    </button>
                ))}
            </div>

            {tab === 'attekintes' && (
                <div className="space-y-4">
                    {project.summary && (
                        <section className="o-card p-5">
                            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                                A munkáról
                            </h2>
                            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                                {project.summary}
                            </p>
                        </section>
                    )}

                    <section className="o-card">
                        <header className="border-b border-line px-5 py-3">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                                Ütemterv
                            </h2>
                        </header>

                        {phases.length === 0 ? (
                            <p className="px-5 py-10 text-center text-sm text-ink-faint">
                                Az ütemterv még összeállítás alatt van.
                            </p>
                        ) : (
                            <div className="divide-y divide-line">
                                {phases.map((ph) => (
                                    <div
                                        key={ph.id}
                                        className="flex flex-wrap items-center gap-3 px-5 py-2.5"
                                        style={{ paddingLeft: 20 + ph.level * 16 }}
                                    >
                                        <span
                                            className={clsx(
                                                'min-w-0 flex-1 truncate text-sm',
                                                ph.is_group
                                                    ? 'font-semibold text-sidebar'
                                                    : 'text-ink',
                                            )}
                                        >
                                            {ph.is_milestone && (
                                                <Flag
                                                    size={13}
                                                    className="mr-1.5 inline text-accent"
                                                />
                                            )}
                                            {ph.name}
                                        </span>
                                        <span className="hidden w-44 shrink-0 text-xs text-ink-faint sm:block">
                                            {fmtDate(ph.starts_on)} – {fmtDate(ph.due_on)}
                                        </span>
                                        <span className="flex w-28 shrink-0 items-center gap-2">
                                            <ProgressBar value={ph.progress} className="flex-1" />
                                            <span className="w-8 text-right text-xs text-ink-soft">
                                                {ph.progress}%
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {tab === 'dokumentumok' && (
                <section className="o-card">
                    {documents.length === 0 ? (
                        <p className="px-5 py-12 text-center text-sm text-ink-faint">
                            Ehhez a projekthez még nem osztottunk meg dokumentumot.
                        </p>
                    ) : (
                        <div className="divide-y divide-line">
                            {documents.map((d) => {
                                const Icon = fileIcon(null, d.filename);
                                return (
                                    <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent">
                                            <Icon size={18} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="truncate text-sm font-medium text-ink">
                                                    {d.title}
                                                </span>
                                                <span className="chip chip-grey shrink-0">
                                                    {d.category_label}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 truncate text-xs text-ink-faint">
                                                {d.filename} · {fmtBytes(d.size_bytes)} ·{' '}
                                                {fmtDate(d.updated_at)}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {d.previewable && (
                                                <a
                                                    href={route('ugyfel.fajl.megtekintes', d.version_id)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="rounded-lg p-2 text-ink-soft hover:bg-cream hover:text-accent"
                                                    title="Megtekintés"
                                                >
                                                    <Eye size={17} />
                                                </a>
                                            )}
                                            <a
                                                href={route('ugyfel.fajl.letoltes', d.version_id)}
                                                className="rounded-lg p-2 text-ink-soft hover:bg-cream hover:text-accent"
                                                title="Letöltés"
                                            >
                                                <Download size={17} />
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {tab === 'haladas' && (
                <div className="space-y-4">
                    {reports.length === 0 ? (
                        <div className="o-card px-5 py-12 text-center text-sm text-ink-faint">
                            Még nincs megosztott haladás-bejegyzés. Amint a helyszíni munka
                            beindul, itt fogja látni a fotókat és a rövid összefoglalókat.
                        </div>
                    ) : (
                        reports.map((r) => (
                            <article key={r.id} className="o-card p-5">
                                <header className="mb-2 flex flex-wrap items-center gap-3">
                                    <h3 className="text-sm font-semibold text-sidebar">
                                        {fmtDate(r.report_date)}
                                    </h3>
                                    {r.weather && <WeatherChip weather={r.weather} />}
                                </header>

                                {r.work_done && (
                                    <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                                        {r.work_done}
                                    </p>
                                )}

                                {r.photos.length > 0 && (
                                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {r.photos.map((photo) => (
                                            <button
                                                key={photo.id}
                                                type="button"
                                                onClick={() => setLightbox(photo)}
                                                className="overflow-hidden rounded-md border border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                                            >
                                                <img
                                                    src={photo.url}
                                                    alt={photo.filename}
                                                    loading="lazy"
                                                    className="h-28 w-full object-cover transition hover:scale-105"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </article>
                        ))
                    )}
                </div>
            )}

            {tab === 'ajanlatok' && (
                <div className="space-y-4">
                    {quotes.length === 0 ? (
                        <div className="o-card px-5 py-12 text-center text-sm text-ink-faint">
                            Ehhez a projekthez még nem osztottunk meg árajánlatot.
                        </div>
                    ) : (
                        quotes.map((q) => <QuoteResponse key={q.id} quote={q} />)
                    )}
                </div>
            )}

            {/* Fotó nagyban */}
            <Dialog
                open={lightbox !== null}
                onClose={() => setLightbox(null)}
                className="relative z-40"
            >
                <DialogBackdrop className="fixed inset-0 bg-black/80" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <DialogPanel className="relative max-h-full max-w-4xl">
                        <button
                            type="button"
                            onClick={() => setLightbox(null)}
                            className="absolute -top-10 right-0 rounded-lg p-2 text-white/80 hover:text-white"
                            aria-label="Bezárás"
                        >
                            <X size={22} />
                        </button>
                        {lightbox && (
                            <img
                                src={lightbox.url}
                                alt={lightbox.filename}
                                className="max-h-[85dvh] rounded-lg object-contain"
                            />
                        )}
                    </DialogPanel>
                </div>
            </Dialog>

            {project.status === 'lezart' && (
                <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-faint">
                    <CheckCircle2 size={16} className="text-accent" />
                    Ez a munka lezárult. Köszönjük a bizalmát!
                </p>
            )}
        </>
    );
}

ProjectPage.layout = (page: ReactNode) => <PortalLayout>{page}</PortalLayout>;
