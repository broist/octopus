import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { ClipboardCheck, Plus, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import QaNav from '@/Pages/Qa/Partials/QaNav';
import InspectionStartModal from '@/Pages/Qa/Partials/InspectionStartModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { InspectionRow, Paginator, ProjectRef, QaTemplateOption } from '@/types/models';

interface InspectionsProps extends Record<string, unknown> {
    inspections: Paginator<InspectionRow>;
    filters: { project: number | null; status: string };
    projects: ProjectRef[];
    templates: QaTemplateOption[];
    purposes: Record<string, string>;
    canCreate: boolean;
}

const selectClass = 'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

function paginationLabel(label: string): string {
    return label.replace('&laquo;', '«').replace('&raquo;', '»').replace('Previous', 'Előző').replace('Next', 'Következő');
}

export default function Inspections() {
    const { inspections, filters, projects, templates, purposes, canCreate } = usePageProps<InspectionsProps>();
    const [modal, setModal] = useState(false);
    const [project, setProject] = useState(filters.project ? String(filters.project) : '');
    const [status, setStatus] = useState(filters.status);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(route('qa.inspections.index'), {
                project: project || undefined,
                status: status || undefined,
            }, { preserveState: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [project, status]);

    return (
        <>
            <Head title="Ellenőrzések" />

            <PageHeader
                title="Minőség / Munkavédelem"
                subtitle="Ellenőrzések — checklist kitöltése projektenként; a nem megfelelt pontokból egy kattintással hiba nyitható."
                actions={
                    canCreate && (
                        <button className="btn-primary" onClick={() => setModal(true)}>
                            <Plus size={16} />
                            Új ellenőrzés
                        </button>
                    )
                }
            />

            <QaNav active="inspections" />

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <select value={project} onChange={(e) => setProject(e.target.value)} className={`${selectClass} sm:w-60`}>
                    <option value="">Minden projekt</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                    ))}
                </select>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} sm:w-48`}>
                    <option value="">Minden státusz</option>
                    <option value="folyamatban">Folyamatban</option>
                    <option value="lezart">Lezárt</option>
                </select>
            </div>

            {inspections.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <ClipboardCheck size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Még nincs ellenőrzés</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">Indítson ellenőrzést egy sablonból vagy szabadon.</p>
                    {canCreate && (
                        <button className="btn-primary mt-5" onClick={() => setModal(true)}>
                            <Plus size={16} />
                            Új ellenőrzés
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {inspections.data.map((i) => (
                        <Link key={i.id} href={route('qa.inspections.show', i.id)} className="block px-4 py-3 transition hover:bg-cream/40">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-ink">{i.title}</span>
                                        <span className="chip chip-grey">{i.purpose_label}</span>
                                        <span className={clsx('chip', i.status === 'lezart' ? 'chip-green' : 'chip-amber')}>
                                            {i.status === 'lezart' ? 'Lezárt' : 'Folyamatban'}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                                        {i.project && <span className="font-mono">{i.project.code}</span>}
                                        <span>{fmtDate(i.inspected_on)}</span>
                                        {i.template_name && <span>Sablon: {i.template_name}</span>}
                                        <span>{i.items_count} pont</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    {i.failed_count > 0 && (
                                        <span className="inline-flex items-center gap-1 text-coral"><TriangleAlert size={13} />{i.failed_count} nem megfelelt</span>
                                    )}
                                    {i.defects_count > 0 && <span className="text-ink-faint">{i.defects_count} hiba</span>}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {inspections.data.length > 0 && inspections.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {inspections.links.map((link, idx) =>
                        link.url ? (
                            <Link key={idx} href={link.url} preserveState className={clsx('rounded-md px-3 py-1.5 text-sm', link.active ? 'bg-accent font-medium text-white' : 'text-ink-soft hover:bg-white')}>
                                {paginationLabel(link.label)}
                            </Link>
                        ) : (
                            <span key={idx} className="px-3 py-1.5 text-sm text-ink-faint">{paginationLabel(link.label)}</span>
                        ),
                    )}
                </div>
            )}

            {modal && (
                <InspectionStartModal projects={projects} templates={templates} purposes={purposes} onClose={() => setModal(false)} />
            )}
        </>
    );
}

Inspections.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
