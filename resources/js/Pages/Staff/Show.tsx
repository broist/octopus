import { ReactNode, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    CalendarDays,
    Clock,
    Download,
    FolderKanban,
    Mail,
    PalmtreeIcon,
    Pencil,
    Phone,
    Plus,
    ShieldCheck,
    TriangleAlert,
    Trash2,
    UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StaffHrModal from '@/Pages/Staff/Partials/StaffHrModal';
import QualificationModal from '@/Pages/Staff/Partials/QualificationModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type {
    CertStatus,
    StaffAbsence,
    StaffDetail,
    StaffHoursByProject,
    StaffQualification,
    StaffWorkLog,
} from '@/types/models';

interface ShowProps extends Record<string, unknown> {
    staff: StaffDetail;
    qualifications: StaffQualification[];
    work_logs: StaffWorkLog[];
    month_hours: number;
    hours_by_project: StaffHoursByProject[];
    absences: StaffAbsence[];
    can_log_hours: boolean;
    projects: { id: number; code: string; name: string }[];
    qualification_types: Record<string, string>;
    absence_types: Record<string, string>;
}

const CERT_BADGE: Record<CertStatus, { label: string; className: string }> = {
    ok: { label: 'Érvényes', className: 'chip-green' },
    soon: { label: 'Hamarosan lejár', className: 'chip-amber' },
    expired: { label: 'Lejárt', className: 'bg-coral/15 text-coral' },
};

const fmtHours = (h: number) => `${Number(h).toLocaleString('hu-HU', { maximumFractionDigits: 2 })} ó`;

function InfoRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: ReactNode }) {
    return (
        <div className="flex items-start gap-2.5">
            <Icon size={16} className="mt-0.5 shrink-0 text-ink-faint" />
            <div className="min-w-0">
                <div className="text-xs text-ink-faint">{label}</div>
                <div className="text-sm font-medium text-ink">{children}</div>
            </div>
        </div>
    );
}

function CardHeader({
    icon: Icon,
    title,
    count,
    action,
}: {
    icon: typeof Mail;
    title: string;
    count?: number;
    action?: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-sidebar">
                <Icon size={16} />
                {title}
                {count !== undefined && (
                    <span className="rounded-sm bg-cream px-1.5 py-0.5 text-xs text-ink-faint">{count}</span>
                )}
            </h2>
            {action}
        </div>
    );
}

export default function Show() {
    const {
        staff,
        qualifications,
        work_logs,
        month_hours,
        hours_by_project,
        absences,
        can_log_hours,
        projects,
        qualification_types,
        absence_types,
        auth,
    } = usePageProps<ShowProps>();

    const canEdit = auth.permissions.includes('staff.edit');

    const [hrOpen, setHrOpen] = useState(false);
    const [qualOpen, setQualOpen] = useState(false);

    const logForm = useForm<{ work_date: string; hours: string; project_id: string; note: string }>({
        work_date: new Date().toISOString().slice(0, 10),
        hours: '8',
        project_id: '',
        note: '',
    });
    const absenceForm = useForm<{ type: string; starts_on: string; ends_on: string; note: string }>({
        type: 'szabadsag',
        starts_on: '',
        ends_on: '',
        note: '',
    });

    const submitLog = (e: React.FormEvent) => {
        e.preventDefault();
        logForm.post(route('staff.work-logs.store', staff.id), {
            preserveScroll: true,
            onSuccess: () => logForm.reset('note'),
        });
    };
    const submitAbsence = (e: React.FormEvent) => {
        e.preventDefault();
        absenceForm.post(route('staff.absences.store', staff.id), {
            preserveScroll: true,
            onSuccess: () => absenceForm.reset(),
        });
    };

    const currentAbsence = absences.find((a) => a.is_current);

    return (
        <>
            <Head title={staff.name} />

            <Link
                href={route('staff.index')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza a munkatársakhoz
            </Link>

            <PageHeader
                title={staff.name}
                actions={
                    canEdit && (
                        <button className="btn-ghost" onClick={() => setHrOpen(true)}>
                            <Pencil size={16} />
                            HR-adatok
                        </button>
                    )
                }
            />

            <div className="mb-5 flex flex-wrap items-center gap-2">
                {staff.role && <span className="chip bg-sidebar/10 text-sidebar">{staff.role}</span>}
                {!staff.is_active && <span className="chip chip-grey">Inaktív fiók</span>}
                {currentAbsence && (
                    <span className="chip inline-flex items-center gap-1 bg-amber-100 text-amber-700">
                        <PalmtreeIcon size={12} />
                        {currentAbsence.type_label} ({fmtDate(currentAbsence.ends_on)}-ig)
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Bal oszlop */}
                <div className="space-y-5 lg:col-span-1">
                    <div className="o-card p-5">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Adatok
                        </h2>
                        <div className="space-y-3.5">
                            {staff.job_title && (
                                <InfoRow icon={UserRound} label="Beosztás">
                                    {staff.job_title}
                                </InfoRow>
                            )}
                            <InfoRow icon={Mail} label="E-mail">
                                <a href={`mailto:${staff.email}`} className="text-accent hover:underline">
                                    {staff.email}
                                </a>
                            </InfoRow>
                            {staff.phone && (
                                <InfoRow icon={Phone} label="Telefon">
                                    <a href={`tel:${staff.phone}`} className="text-accent hover:underline">
                                        {staff.phone}
                                    </a>
                                </InfoRow>
                            )}
                            <InfoRow icon={CalendarDays} label="Belépés dátuma">
                                {staff.hired_on ? fmtDate(staff.hired_on) : '—'}
                            </InfoRow>
                        </div>
                    </div>

                    <div className="o-card p-5">
                        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Munkaidő – aktuális hónap
                        </h2>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-semibold text-sidebar">
                                {Number(month_hours).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}
                            </span>
                            <span className="text-sm text-ink-soft">óra</span>
                        </div>
                        {hours_by_project.length > 0 && (
                            <div className="mt-4 space-y-1.5 border-t border-line pt-3">
                                <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                                    Projektbontás (összes)
                                </div>
                                {hours_by_project.map((row, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span className="min-w-0 truncate text-ink-soft">
                                            {row.project ? (
                                                <Link
                                                    href={route('projects.show', row.project.id)}
                                                    className="hover:text-accent"
                                                >
                                                    {row.project.code} – {row.project.name}
                                                </Link>
                                            ) : (
                                                'Projekt nélkül'
                                            )}
                                        </span>
                                        <span className="shrink-0 font-medium text-ink">
                                            {fmtHours(row.hours)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Jobb oszlop */}
                <div className="space-y-5 lg:col-span-2">
                    {/* Végzettségek / jogosultságok */}
                    <div className="o-card">
                        <CardHeader
                            icon={ShieldCheck}
                            title="Végzettségek / jogosultságok"
                            count={qualifications.length}
                            action={
                                canEdit && (
                                    <button className="btn-ghost !py-1 text-xs" onClick={() => setQualOpen(true)}>
                                        <Plus size={14} />
                                        Új
                                    </button>
                                )
                            }
                        />
                        {qualifications.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-ink-faint">
                                Nincs rögzített végzettség vagy jogosultság.
                            </p>
                        ) : (
                            <div className="divide-y divide-line">
                                {qualifications.map((q) => (
                                    <div key={q.id} className="flex items-center gap-3 px-5 py-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-medium text-ink">{q.name}</span>
                                                <span className="chip chip-grey">{q.type_label}</span>
                                                <span className={clsx('chip', CERT_BADGE[q.status].className)}>
                                                    {CERT_BADGE[q.status].label}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                                                {q.issuer && <span>{q.issuer}</span>}
                                                {q.valid_until && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <CalendarClock size={12} />
                                                        Lejárat: {fmtDate(q.valid_until)}
                                                    </span>
                                                )}
                                                {q.note && <span>{q.note}</span>}
                                            </div>
                                        </div>
                                        {q.download_url && (
                                            <a href={q.download_url} className="btn-ghost !p-2" title={q.file_name ?? 'Letöltés'}>
                                                <Download size={15} />
                                            </a>
                                        )}
                                        {canEdit && (
                                            <button
                                                onClick={() => {
                                                    if (confirm('Törli ezt a tételt?')) {
                                                        router.delete(
                                                            route('staff.qualifications.destroy', q.id),
                                                            { preserveScroll: true },
                                                        );
                                                    }
                                                }}
                                                className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                                title="Törlés"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Munkaidő-nyilvántartás */}
                    <div className="o-card">
                        <CardHeader icon={Clock} title="Munkaidő-nyilvántartás" count={work_logs.length} />
                        <div className="max-h-80 divide-y divide-line overflow-y-auto">
                            {work_logs.map((l) => (
                                <div key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                                    <span className="w-24 shrink-0 text-xs font-medium text-ink-soft">
                                        {fmtDate(l.work_date)}
                                    </span>
                                    <span className="w-16 shrink-0 text-sm font-semibold text-ink">
                                        {fmtHours(l.hours)}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">
                                        {l.project ? (
                                            <span className="text-ink-soft">{l.project.code}</span>
                                        ) : (
                                            'Projekt nélkül'
                                        )}
                                        {l.note && ` · ${l.note}`}
                                    </span>
                                    {can_log_hours && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Törli ezt a bejegyzést?')) {
                                                    router.delete(route('staff.work-logs.destroy', l.id), {
                                                        preserveScroll: true,
                                                    });
                                                }
                                            }}
                                            className="btn-ghost !p-1.5 text-coral hover:bg-coral/10"
                                            title="Törlés"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {work_logs.length === 0 && (
                                <p className="px-5 py-6 text-center text-sm text-ink-faint">
                                    Még nincs rögzített munkaidő.
                                </p>
                            )}
                        </div>

                        {can_log_hours && (
                            <form
                                onSubmit={submitLog}
                                className="flex flex-col gap-2 border-t border-line bg-cream/30 px-5 py-3 sm:flex-row sm:items-center"
                            >
                                <input
                                    type="date"
                                    value={logForm.data.work_date}
                                    onChange={(e) => logForm.setData('work_date', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <input
                                    type="number"
                                    step="0.25"
                                    min="0.25"
                                    max="24"
                                    value={logForm.data.hours}
                                    onChange={(e) => logForm.setData('hours', e.target.value)}
                                    placeholder="óra"
                                    className="w-20 rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <select
                                    value={logForm.data.project_id}
                                    onChange={(e) => logForm.setData('project_id', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 sm:w-40"
                                >
                                    <option value="">Projekt…</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.code}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={logForm.data.note}
                                    onChange={(e) => logForm.setData('note', e.target.value)}
                                    placeholder="Megjegyzés…"
                                    className="flex-1 rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <button type="submit" className="btn-primary !py-1.5" disabled={logForm.processing}>
                                    Rögzít
                                </button>
                            </form>
                        )}
                        {logForm.errors.hours && (
                            <p className="px-5 pb-3 text-xs text-coral">{logForm.errors.hours}</p>
                        )}
                        {logForm.errors.work_date && (
                            <p className="px-5 pb-3 text-xs text-coral">{logForm.errors.work_date}</p>
                        )}
                    </div>

                    {/* Szabadság / távollét */}
                    <div className="o-card">
                        <CardHeader icon={PalmtreeIcon} title="Szabadság / távollét" count={absences.length} />
                        <div className="divide-y divide-line">
                            {absences.map((a) => (
                                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium text-ink">
                                                {fmtDate(a.starts_on)} – {fmtDate(a.ends_on)}
                                            </span>
                                            <span
                                                className={clsx(
                                                    'chip',
                                                    a.is_current
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : a.is_future
                                                          ? 'bg-sidebar/10 text-sidebar'
                                                          : 'chip-grey',
                                                )}
                                            >
                                                {a.type_label}
                                            </span>
                                            {a.is_current && (
                                                <span className="text-xs font-medium text-amber-700">most</span>
                                            )}
                                        </div>
                                        {a.note && <p className="mt-0.5 text-xs text-ink-faint">{a.note}</p>}
                                    </div>
                                    {canEdit && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Törli ezt a távollétet?')) {
                                                    router.delete(route('staff.absences.destroy', a.id), {
                                                        preserveScroll: true,
                                                    });
                                                }
                                            }}
                                            className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                            title="Törlés"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {absences.length === 0 && (
                                <p className="px-5 py-6 text-center text-sm text-ink-faint">
                                    Nincs rögzített szabadság vagy távollét.
                                </p>
                            )}
                        </div>

                        {canEdit && (
                            <form
                                onSubmit={submitAbsence}
                                className="flex flex-col gap-2 border-t border-line bg-cream/30 px-5 py-3 sm:flex-row sm:items-center"
                            >
                                <select
                                    value={absenceForm.data.type}
                                    onChange={(e) => absenceForm.setData('type', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 sm:w-40"
                                >
                                    {Object.entries(absence_types).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="date"
                                    value={absenceForm.data.starts_on}
                                    onChange={(e) => absenceForm.setData('starts_on', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <span className="text-sm text-ink-faint">–</span>
                                <input
                                    type="date"
                                    value={absenceForm.data.ends_on}
                                    onChange={(e) => absenceForm.setData('ends_on', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <button type="submit" className="btn-primary !py-1.5" disabled={absenceForm.processing}>
                                    Rögzít
                                </button>
                            </form>
                        )}
                        {(absenceForm.errors.starts_on || absenceForm.errors.ends_on) && (
                            <p className="px-5 pb-3 text-xs text-coral">
                                {absenceForm.errors.starts_on || absenceForm.errors.ends_on}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {hrOpen && <StaffHrModal staff={staff} onClose={() => setHrOpen(false)} />}
            {qualOpen && (
                <QualificationModal
                    userId={staff.id}
                    types={qualification_types}
                    onClose={() => setQualOpen(false)}
                />
            )}
        </>
    );
}

Show.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
