import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { GraduationCap, HardHat, Pencil, Plus, ShieldAlert, Trash2, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import QaNav from '@/Pages/Qa/Partials/QaNav';
import SafetyModal from '@/Pages/Qa/Partials/SafetyModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { LucideIcon } from 'lucide-react';
import type { Paginator, ProjectRef, SafetyRecordItem } from '@/types/models';

interface SafetyProps extends Record<string, unknown> {
    records: Paginator<SafetyRecordItem>;
    filters: { type: string; project: number | null };
    types: Record<string, string>;
    projects: ProjectRef[];
    canManage: boolean;
}

const selectClass = 'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

const TYPE_ICON: Record<string, LucideIcon> = {
    oktatas: GraduationCap,
    bejaras: HardHat,
    esemeny: ShieldAlert,
    baleset: TriangleAlert,
};
const TYPE_TONE: Record<string, string> = {
    oktatas: 'bg-sidebar/10 text-sidebar',
    bejaras: 'bg-accent-50 text-accent-700',
    esemeny: 'chip-amber',
    baleset: 'chip-coral',
};

function paginationLabel(label: string): string {
    return label.replace('&laquo;', '«').replace('&raquo;', '»').replace('Previous', 'Előző').replace('Next', 'Következő');
}

export default function Safety() {
    const { records, filters, types, projects, canManage } = usePageProps<SafetyProps>();
    const canDelete = canManage;
    const [modal, setModal] = useState<{ record: SafetyRecordItem | null } | null>(null);
    const [type, setType] = useState(filters.type);
    const [project, setProject] = useState(filters.project ? String(filters.project) : '');
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(route('qa.safety.index'), {
                type: type || undefined,
                project: project || undefined,
            }, { preserveState: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [type, project]);

    return (
        <>
            <Head title="Munkavédelmi nyilvántartás" />

            <PageHeader
                title="Minőség / Munkavédelem"
                subtitle="Munkavédelmi nyilvántartás — oktatások, bejárások, esemény- és baleseti napló."
                actions={
                    canManage && (
                        <button className="btn-primary" onClick={() => setModal({ record: null })}>
                            <Plus size={16} />
                            Új bejegyzés
                        </button>
                    )
                }
            />

            <QaNav active="safety" />

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <select value={type} onChange={(e) => setType(e.target.value)} className={`${selectClass} sm:w-48`}>
                    <option value="">Minden típus</option>
                    {Object.entries(types).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
                <select value={project} onChange={(e) => setProject(e.target.value)} className={`${selectClass} sm:w-60`}>
                    <option value="">Minden projekt</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                    ))}
                </select>
            </div>

            {records.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <ShieldAlert size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs munkavédelmi bejegyzés</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">Rögzítsen oktatást, bejárást vagy eseményt.</p>
                    {canManage && (
                        <button className="btn-primary mt-5" onClick={() => setModal({ record: null })}>
                            <Plus size={16} />
                            Új bejegyzés
                        </button>
                    )}
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {records.data.map((r) => {
                        const Icon = TYPE_ICON[r.type] ?? ShieldAlert;
                        return (
                            <div key={r.id} className="flex gap-3 px-4 py-3">
                                <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TYPE_TONE[r.type] ?? 'chip-grey')}>
                                    <Icon size={18} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-ink">{r.title}</span>
                                        <span className={clsx('chip', TYPE_TONE[r.type] ?? 'chip-grey')}>{r.type_label}</span>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-faint">
                                        <span>{fmtDate(r.occurred_on)}</span>
                                        {r.project && (
                                            <Link href={route('projects.show', r.project.id)} className="font-mono hover:text-accent">{r.project.code}</Link>
                                        )}
                                        {r.participants && <span className="truncate">Résztvevők: {r.participants}</span>}
                                    </div>
                                    {r.description && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{r.description}</p>}
                                </div>
                                {canManage && (
                                    <div className="flex shrink-0 items-start gap-1">
                                        <button onClick={() => setModal({ record: r })} className="btn-ghost !p-2" title="Szerkesztés">
                                            <Pencil size={15} />
                                        </button>
                                        {canDelete && (
                                            <button
                                                onClick={() => {
                                                    if (confirm('Törli ezt a bejegyzést?')) {
                                                        router.delete(route('qa.safety.destroy', r.id), { preserveScroll: true });
                                                    }
                                                }}
                                                className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                                title="Törlés"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {records.data.length > 0 && records.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {records.links.map((link, i) =>
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
                <SafetyModal record={modal.record} types={types} projects={projects} onClose={() => setModal(null)} />
            )}
        </>
    );
}

Safety.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
