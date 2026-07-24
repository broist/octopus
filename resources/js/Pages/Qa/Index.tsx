import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    CheckCircle2,
    ClipboardList,
    ImageIcon,
    ListPlus,
    Pencil,
    Plus,
    TriangleAlert,
    User as UserIcon,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import QaNav from '@/Pages/Qa/Partials/QaNav';
import DefectModal from '@/Pages/Qa/Partials/DefectModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { DefectItem, Option, Paginator, ProjectRef } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    defects: Paginator<DefectItem>;
    filters: { project: number | null; status: string; responsible: number | null; mine: boolean };
    stats: { open: number; in_progress: number; closed: number; overdue: number };
    projects: ProjectRef[];
    users: Option[];
    statuses: Record<string, string>;
    severities: Record<string, string>;
}

const selectClass = 'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

const STATUS_CHIP: Record<string, string> = {
    nyitott: 'chip-amber',
    javitas_alatt: 'bg-sidebar/10 text-sidebar',
    lezart: 'chip-green',
};
const SEVERITY_CHIP: Record<string, string> = {
    magas: 'chip-coral',
    kozepes: 'chip-amber',
    alacsony: 'chip-grey',
};

function paginationLabel(label: string): string {
    return label.replace('&laquo;', '«').replace('&raquo;', '»').replace('Previous', 'Előző').replace('Next', 'Következő');
}

function StatTile({ label, value, tone, active, onClick }: {
    label: string; value: number; tone?: 'coral'; active?: boolean; onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx('o-card px-4 py-3 text-left transition', onClick && 'hover:border-accent/40', active && 'border-accent ring-1 ring-accent/30')}
        >
            <div className={clsx('text-2xl font-semibold', tone === 'coral' && value > 0 ? 'text-coral' : 'text-sidebar')}>{value}</div>
            <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
        </button>
    );
}

export default function Index() {
    const { defects, filters, stats, projects, users, statuses, severities, auth } = usePageProps<IndexProps>();
    const canCreate = auth.permissions.includes('qa.create');
    const canEdit = auth.permissions.includes('qa.edit');
    const canDelete = auth.permissions.includes('qa.delete');

    const [modal, setModal] = useState<{ defect: DefectItem | null } | null>(null);
    const [project, setProject] = useState(filters.project ? String(filters.project) : '');
    const [status, setStatus] = useState(filters.status);
    const [responsible, setResponsible] = useState(filters.responsible ? String(filters.responsible) : '');
    const [mine, setMine] = useState(filters.mine);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(route('qa.index'), {
                project: project || undefined,
                status: status || undefined,
                responsible: responsible || undefined,
                mine: mine || undefined,
            }, { preserveState: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [project, status, responsible, mine]);

    const toggleStatus = (s: string) => setStatus((cur) => (cur === s ? '' : s));

    return (
        <>
            <Head title="Minőség / Munkavédelem" />

            <PageHeader
                title="Minőség / Munkavédelem"
                subtitle="Hibalisták, ellenőrzések és munkavédelmi nyilvántartás — helyszíni fotókkal, feladatokhoz kötve."
                actions={
                    canCreate && (
                        <button className="btn-primary" onClick={() => setModal({ defect: null })}>
                            <Plus size={16} />
                            Új hiba
                        </button>
                    )
                }
            />

            <QaNav active="defects" />

            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Nyitott" value={stats.open} active={status === 'nyitott'} onClick={() => toggleStatus('nyitott')} />
                <StatTile label="Javítás alatt" value={stats.in_progress} active={status === 'javitas_alatt'} onClick={() => toggleStatus('javitas_alatt')} />
                <StatTile label="Lezárt" value={stats.closed} active={status === 'lezart'} onClick={() => toggleStatus('lezart')} />
                <StatTile label="Lejárt határidő" value={stats.overdue} tone="coral" />
            </div>

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <select value={project} onChange={(e) => setProject(e.target.value)} className={`${selectClass} sm:w-60`}>
                    <option value="">Minden projekt</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                    ))}
                </select>
                <select value={responsible} onChange={(e) => setResponsible(e.target.value)} className={`${selectClass} sm:w-52`}>
                    <option value="">Minden felelős</option>
                    {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="rounded-sm border-line text-accent focus:ring-accent/40" />
                    Rám kiosztott
                </label>
            </div>

            {defects.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <TriangleAlert size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs a szűrésnek megfelelő hiba</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.project || filters.status || filters.responsible || filters.mine
                            ? 'Módosítsa a szűrőket.'
                            : 'Rögzítse az első hibát vagy hiányosságot — leírás, fotó, felelős, határidő.'}
                    </p>
                    {canCreate && (
                        <button className="btn-primary mt-5" onClick={() => setModal({ defect: null })}>
                            <Plus size={16} />
                            Új hiba
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {defects.data.map((d) => (
                        <div key={d.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={clsx('chip', SEVERITY_CHIP[d.severity] ?? 'chip-grey')}>{d.severity_label}</span>
                                    <span className="text-sm font-medium text-ink">{d.title}</span>
                                    {d.is_overdue && (
                                        <span className="inline-flex items-center gap-1 text-xs text-coral"><TriangleAlert size={12} />lejárt</span>
                                    )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                                    {d.project && (
                                        <Link href={route('projects.show', d.project.id)} className="font-mono hover:text-accent">{d.project.code}</Link>
                                    )}
                                    {d.responsible_name && (
                                        <span className="inline-flex items-center gap-1"><UserIcon size={11} />{d.responsible_name}</span>
                                    )}
                                    {d.due_on && <span className={clsx(d.is_overdue && 'text-coral')}>Határidő: {fmtDate(d.due_on)}</span>}
                                    {d.photos_count > 0 && (
                                        <span className="inline-flex items-center gap-1"><ImageIcon size={11} />{d.photos_count}</span>
                                    )}
                                    {d.inspection && <span>Ellenőrzésből</span>}
                                </div>
                                {d.photos.length > 0 && (
                                    <div className="mt-2 flex gap-1.5">
                                        {d.photos.slice(0, 5).map((p) => (
                                            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="h-12 w-12 overflow-hidden rounded border border-line">
                                                {p.is_image ? <img src={p.url} alt={p.name} className="h-full w-full object-cover" /> : null}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                                <span className={clsx('chip w-28 justify-center', STATUS_CHIP[d.status] ?? 'chip-grey')}>{d.status_label}</span>
                                <div className="flex items-center gap-1">
                                    {d.task_id ? (
                                        <Link href={route('tasks.index')} className="btn-ghost !py-1 text-xs text-accent" title="Feladat megnyitása">
                                            Feladat ✓
                                        </Link>
                                    ) : (
                                        canEdit && (
                                            <button
                                                onClick={() => router.post(route('qa.defects.to-task', d.id), {}, { preserveScroll: true })}
                                                className="btn-ghost !py-1 text-xs text-accent"
                                                title="Feladattá alakít"
                                            >
                                                <ListPlus size={14} />
                                                Feladat
                                            </button>
                                        )
                                    )}
                                    {canEdit && d.status !== 'lezart' && (
                                        <button
                                            onClick={() => router.put(route('qa.defects.update', d.id), { ...defectToPayload(d), status: 'lezart' }, { preserveScroll: true })}
                                            className="btn-ghost !p-2 text-accent hover:bg-accent-50"
                                            title="Lezár"
                                        >
                                            <CheckCircle2 size={16} />
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => setModal({ defect: d })} className="btn-ghost !p-2" title="Szerkesztés">
                                            <Pencil size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {defects.data.length > 0 && defects.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {defects.links.map((link, i) =>
                        link.url ? (
                            <Link key={i} href={link.url} preserveState className={clsx('rounded-md px-3 py-1.5 text-sm', link.active ? 'bg-accent font-medium text-white' : 'text-ink-soft hover:bg-white')}>
                                {paginationLabel(link.label)}
                            </Link>
                        ) : (
                            <span key={i} className="px-3 py-1.5 text-sm text-ink-faint">{paginationLabel(link.label)}</span>
                        ),
                    )}
                </div>
            )}

            {modal && (
                <DefectModal
                    defect={modal.defect}
                    projects={projects}
                    users={users}
                    statuses={statuses}
                    severities={severities}
                    onClose={() => setModal(null)}
                />
            )}
        </>
    );
}

/** A gyors „lezárás" művelethez a meglévő mezők visszaküldése (a fotók nélkül). */
function defectToPayload(d: DefectItem) {
    return {
        project_id: d.project?.id,
        inspection_id: d.inspection?.id ?? '',
        title: d.title,
        description: d.description ?? '',
        severity: d.severity,
        responsible_user_id: d.responsible_id ?? '',
        due_on: d.due_on ?? '',
    };
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
