import { ReactNode, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    CalendarRange,
    ListTree,
    MapPin,
    Pencil,
    Plus,
    Trash2,
    User as UserIcon,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import StatusChip, { SlippingChip } from '@/Components/StatusChip';
import ProgressBar from '@/Components/ProgressBar';
import PhasesPanel from '@/Pages/Projects/Partials/PhasesPanel';
import Gantt from '@/Pages/Projects/Partials/Gantt';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtBytes, fmtDate, fmtDateTime } from '@/lib/format';
import { CATEGORY_LABELS, fileIcon } from '@/lib/documents';
import type {
    ActivityItem,
    PhaseItem,
    ProjectDetail,
    ProjectDocumentRow,
    SubprojectItem,
} from '@/types/models';

interface ShowProps extends Record<string, unknown> {
    project: ProjectDetail;
    phases: PhaseItem[];
    subprojects: SubprojectItem[];
    activities: ActivityItem[];
    documents: ProjectDocumentRow[];
    types: Record<string, string>;
}

type Tab = 'attekintes' | 'utemterv' | 'eroforrasok' | 'penzugy' | 'dokumentumok' | 'naplo';

const TABS: { key: Tab; label: string }[] = [
    { key: 'attekintes', label: 'Áttekintés' },
    { key: 'utemterv', label: 'Ütemterv' },
    { key: 'eroforrasok', label: 'Erőforrások' },
    { key: 'penzugy', label: 'Költségvetés' },
    { key: 'dokumentumok', label: 'Dokumentumok' },
    { key: 'naplo', label: 'Napló' },
];

function InfoItem({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof MapPin;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-start gap-2.5">
            <Icon size={16} className="mt-0.5 shrink-0 text-ink-faint" />
            <div>
                <div className="text-xs text-ink-faint">{label}</div>
                <div className="text-sm font-medium text-ink">{children}</div>
            </div>
        </div>
    );
}

function ComingSoon({ title, note }: { title: string; note: string }) {
    return (
        <div className="o-card px-6 py-12 text-center">
            <h3 className="text-base font-semibold text-sidebar">{title}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{note}</p>
        </div>
    );
}

export default function Show() {
    const { project, phases, subprojects, activities, documents, types, auth } =
        usePageProps<ShowProps>();
    const [tab, setTab] = useState<Tab>('attekintes');

    const canEdit = auth.permissions.includes('projects.edit');
    const canCreate = auth.permissions.includes('projects.create');
    const canDelete = auth.permissions.includes('projects.delete');

    const destroy = () => {
        if (
            confirm(
                `Biztosan törli a(z) „${project.name}" projektet? A hozzá tartozó fázisok és napló is törlődik.`,
            )
        ) {
            router.delete(route('projects.destroy', project.id));
        }
    };

    return (
        <>
            <Head title={project.name} />

            {/* Fejléc */}
            <div className="mb-6">
                <Link
                    href={
                        project.parent
                            ? route('projects.show', project.parent.id)
                            : route('projects.index')
                    }
                    className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
                >
                    <ArrowLeft size={15} />
                    {project.parent
                        ? `Vissza: ${project.parent.name}`
                        : 'Vissza a projektekhez'}
                </Link>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-ink-faint">{project.code}</span>
                            <StatusChip status={project.status} />
                            {project.is_slipping && <SlippingChip />}
                            {project.parent && (
                                <span className="chip chip-grey">
                                    <ListTree size={12} />
                                    Alprojekt
                                </span>
                            )}
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-sidebar">
                            {project.name}
                        </h1>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {canCreate && !project.parent && (
                            <Link
                                href={route('projects.create', { parent: project.id })}
                                className="btn-ghost"
                            >
                                <Plus size={15} />
                                Alprojekt
                            </Link>
                        )}
                        {canEdit && (
                            <Link href={route('projects.edit', project.id)} className="btn-ghost">
                                <Pencil size={15} />
                                Szerkesztés
                            </Link>
                        )}
                        {canDelete && (
                            <button
                                onClick={destroy}
                                className="btn inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                            >
                                <Trash2 size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Törzsadat-kártya */}
            <div className="o-card mb-6 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoItem icon={Building2} label="Megrendelő">
                        {project.client?.name ?? '–'}
                    </InfoItem>
                    <InfoItem icon={UserIcon} label="Projektvezető">
                        {project.project_manager?.name ?? '–'}
                    </InfoItem>
                    <InfoItem icon={MapPin} label="Helyszín">
                        {[project.location_city, project.location_address]
                            .filter(Boolean)
                            .join(', ') || '–'}
                    </InfoItem>
                    <InfoItem icon={CalendarRange} label="Időtartam">
                        {fmtDate(project.starts_on)} – {fmtDate(project.ends_on)}
                        {project.construction_type && (
                            <span className="ml-1 text-xs text-ink-faint">
                                ({types[project.construction_type] ?? project.construction_type})
                            </span>
                        )}
                    </InfoItem>
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                        Készültség
                    </span>
                    <ProgressBar
                        value={project.progress}
                        warn={project.is_slipping}
                        className="flex-1"
                    />
                    <span className="text-sm font-semibold text-sidebar">
                        {project.progress}%
                    </span>
                </div>
            </div>

            {/* Fülek */}
            <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
                {TABS.map((t) => (
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
                        {t.key === 'naplo' && activities.length > 0 && (
                            <span className="ml-1.5 text-xs text-ink-faint">
                                {activities.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {tab === 'attekintes' && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        {project.description && (
                            <section className="o-card p-5">
                                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                                    Leírás
                                </h2>
                                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                                    {project.description}
                                </p>
                            </section>
                        )}

                        {!project.parent && (
                            <section className="o-card p-5">
                                <div className="mb-3 flex items-center justify-between">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                                        Alprojektek
                                    </h2>
                                    {canCreate && subprojects.length > 0 && (
                                        <Link
                                            href={route('projects.create', { parent: project.id })}
                                            className="btn-ghost px-3 py-1.5 text-xs"
                                        >
                                            <Plus size={13} />
                                            Új alprojekt
                                        </Link>
                                    )}
                                </div>
                                {subprojects.length === 0 ? (
                                    <p className="text-sm text-ink-faint">
                                        Ehhez a projekthez nincsenek alprojektek. Nagyobb, jól
                                        elkülönülő munkarészekhez érdemes alprojektet nyitni.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {subprojects.map((sp) => (
                                            <Link
                                                key={sp.id}
                                                href={route('projects.show', sp.id)}
                                                className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5 transition hover:border-accent/40 hover:bg-cream/50"
                                            >
                                                <span className="font-mono text-xs text-ink-faint">
                                                    {sp.code}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                                                    {sp.name}
                                                </span>
                                                {sp.is_slipping && <SlippingChip />}
                                                <StatusChip status={sp.status} />
                                                <span className="hidden w-28 items-center gap-2 sm:flex">
                                                    <ProgressBar value={sp.progress} className="flex-1" />
                                                    <span className="text-xs text-ink-soft">
                                                        {sp.progress}%
                                                    </span>
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    <section className="o-card h-fit p-5">
                        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Legutóbbi események
                        </h2>
                        {activities.length === 0 ? (
                            <p className="text-sm text-ink-faint">Még nincs bejegyzés.</p>
                        ) : (
                            <ol className="space-y-3">
                                {activities.slice(0, 8).map((a) => (
                                    <li key={a.id} className="flex gap-2.5 text-sm">
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                        <div className="min-w-0">
                                            <p className="text-ink">{a.description}</p>
                                            <p className="text-xs text-ink-faint">
                                                {a.user_name ? `${a.user_name} · ` : ''}
                                                {fmtDateTime(a.created_at)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            )}

            {tab === 'utemterv' && (
                <div className="space-y-4">
                    <Gantt phases={phases} />
                    <PhasesPanel projectId={project.id} phases={phases} canEdit={canEdit} />
                </div>
            )}

            {tab === 'eroforrasok' && (
                <ComingSoon
                    title="Projekthez rendelt erőforrások"
                    note="Alvállalkozók, saját munkatársak, gépek és anyagok összesítője — az Alvállalkozók (5.), Munkatársak (6.), Gépek (7.) és Anyagok (8.) modulok elkészültével telik meg élettel."
                />
            )}

            {tab === 'penzugy' && (
                <ComingSoon
                    title="Költségvetés-összegzés"
                    note="Tervezett vs. tényleges költség projektszinten, túllépés-jelzéssel — a Pénzügy / Költségvetés (9.) modul elkészültével jelenik meg itt."
                />
            )}

            {tab === 'dokumentumok' && (
                <section className="o-card">
                    <header className="flex items-center justify-between px-4 py-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Kapcsolódó dokumentumok
                        </h2>
                        <Link
                            href={route('documents.index', { project: project.id })}
                            className="btn-ghost px-3 py-1.5 text-xs"
                        >
                            Megnyitás a Fájlkezelőben
                        </Link>
                    </header>

                    {documents.length === 0 ? (
                        <div className="border-t border-line px-4 py-10 text-center text-sm text-ink-faint">
                            Ehhez a projekthez még nincs feltöltött dokumentum. A Fájlkezelőben
                            tölthet fel fájlt, és kötheti ehhez a projekthez.
                        </div>
                    ) : (
                        <div className="divide-y divide-line border-t border-line">
                            {documents.map((d) => {
                                const Icon = fileIcon(null, d.original_filename);
                                return (
                                    <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent">
                                            <Icon size={18} />
                                        </span>
                                        <Link
                                            href={route('documents.show', d.id)}
                                            className="min-w-0 flex-1"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-medium text-ink hover:text-accent-700">
                                                    {d.title}
                                                </span>
                                                <span className="chip chip-grey shrink-0">
                                                    {CATEGORY_LABELS[d.category] ?? d.category}
                                                </span>
                                                {d.version_number > 1 && (
                                                    <span className="shrink-0 font-mono text-xs text-ink-faint">
                                                        v{d.version_number}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-0.5 truncate text-xs text-ink-faint">
                                                {d.original_filename} · {fmtBytes(d.size_bytes)} ·{' '}
                                                {fmtDate(d.updated_at)}
                                                {d.uploader_name && ` · ${d.uploader_name}`}
                                            </div>
                                        </Link>
                                        {d.download_version_id && (
                                            <a
                                                href={route(
                                                    'documents.versions.download',
                                                    d.download_version_id,
                                                )}
                                                className="shrink-0 text-xs font-medium text-accent hover:text-accent-700"
                                            >
                                                Letöltés
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {tab === 'naplo' && (
                <section className="o-card p-5">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                        Projekt-napló / tevékenységfolyam
                    </h2>
                    {activities.length === 0 ? (
                        <p className="text-sm text-ink-faint">
                            Még nincs bejegyzés. A projekt eseményei (státuszváltás, fázisok,
                            módosítások) automatikusan ide kerülnek.
                        </p>
                    ) : (
                        <ol className="relative space-y-4 border-l border-line pl-5">
                            {activities.map((a) => (
                                <li key={a.id} className="relative">
                                    <span className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent" />
                                    <p className="text-sm text-ink">{a.description}</p>
                                    <p className="text-xs text-ink-faint">
                                        {a.user_name ? `${a.user_name} · ` : ''}
                                        {fmtDateTime(a.created_at)}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            )}
        </>
    );
}

Show.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
