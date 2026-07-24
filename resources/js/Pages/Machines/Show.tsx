import { ReactNode, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    CalendarDays,
    Download,
    FileText,
    FolderKanban,
    Hash,
    MapPin,
    Paperclip,
    Pencil,
    Plus,
    Trash2,
    TriangleAlert,
    Truck,
    User as UserIcon,
    Wrench,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import MachineModal from '@/Pages/Machines/Partials/MachineModal';
import MaintenanceModal from '@/Pages/Machines/Partials/MaintenanceModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate, fmtBytes } from '@/lib/format';
import type {
    CertStatus,
    MachineBooking,
    MachineDetail,
    MachineDocument,
    MachineMaintenance,
    Option,
} from '@/types/models';

interface ShowProps extends Record<string, unknown> {
    machine: MachineDetail;
    maintenances: MachineMaintenance[];
    documents: MachineDocument[];
    bookings: MachineBooking[];
    current_maintenance_cost: number;
    assignable_projects: { id: number; code: string; name: string }[];
    responsible_options: Option[];
    kinds: Record<string, string>;
    statuses: Record<string, string>;
    ownership: Record<string, string>;
    maintenance_types: Record<string, string>;
    doc_categories: Record<string, string>;
}

const STATUS_CHIP: Record<string, string> = {
    szabad: 'chip-green',
    hasznalatban: 'bg-sidebar/10 text-sidebar',
    szervizben: 'chip-amber',
};

const DATE_BADGE: Record<CertStatus, { label: string; className: string }> = {
    ok: { label: 'Rendben', className: 'chip-green' },
    soon: { label: 'Hamarosan esedékes', className: 'chip-amber' },
    expired: { label: 'Lejárt', className: 'bg-coral/15 text-coral' },
};

const huf = new Intl.NumberFormat('hu-HU');
const fmtHuf = (v: number | null) => (v == null ? '—' : `${huf.format(v)} Ft`);

function InfoRow({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof Hash;
    label: string;
    children: ReactNode;
}) {
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
    icon: typeof Hash;
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
                    <span className="rounded-sm bg-cream px-1.5 py-0.5 text-xs text-ink-faint">
                        {count}
                    </span>
                )}
            </h2>
            {action}
        </div>
    );
}

/** Egy lejárattal figyelt dátum sora státusz-badge-dzsel. */
function DeadlineRow({
    icon: Icon,
    label,
    date,
    status,
}: {
    icon: typeof Hash;
    label: string;
    date: string | null;
    status: CertStatus;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <InfoRow icon={Icon} label={label}>
                {date ? fmtDate(date) : '—'}
            </InfoRow>
            {date && <span className={clsx('chip', DATE_BADGE[status].className)}>{DATE_BADGE[status].label}</span>}
        </div>
    );
}

export default function Show() {
    const {
        machine,
        maintenances,
        documents,
        bookings,
        current_maintenance_cost,
        assignable_projects,
        responsible_options,
        kinds,
        statuses,
        ownership,
        maintenance_types,
        doc_categories,
        auth,
    } = usePageProps<ShowProps>();

    const canEdit = auth.permissions.includes('machines.edit');
    const canDelete = auth.permissions.includes('machines.delete');

    const [editOpen, setEditOpen] = useState(false);
    const [maintOpen, setMaintOpen] = useState(false);

    // Dokumentum-feltöltés
    const docForm = useForm<{ category: string; files: File[] }>({
        category: 'gepkonyv',
        files: [],
    });
    // Foglalás
    const bookingForm = useForm<{ project_id: string; starts_on: string; ends_on: string; note: string }>({
        project_id: '',
        starts_on: '',
        ends_on: '',
        note: '',
    });

    const destroy = () => {
        if (confirm(`Biztosan archiválja: ${machine.name}?`)) {
            router.delete(route('machines.destroy', machine.id));
        }
    };

    const submitDocs = (e: React.FormEvent) => {
        e.preventDefault();
        docForm.post(route('machines.documents.store', machine.id), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => docForm.reset('files'),
        });
    };

    const submitBooking = (e: React.FormEvent) => {
        e.preventDefault();
        bookingForm.post(route('machines.bookings.store', machine.id), {
            preserveScroll: true,
            onSuccess: () => bookingForm.reset(),
        });
    };

    return (
        <>
            <Head title={machine.name} />

            <Link
                href={route('machines.index')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza a gépekhez
            </Link>

            <PageHeader
                title={machine.name}
                actions={
                    <>
                        {canEdit && (
                            <button className="btn-ghost" onClick={() => setEditOpen(true)}>
                                <Pencil size={16} />
                                Szerkesztés
                            </button>
                        )}
                        {canDelete && (
                            <button
                                onClick={destroy}
                                className="btn border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                title="Archiválás"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </>
                }
            />

            {/* Fej-chipek */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className={clsx('chip', STATUS_CHIP[machine.status] ?? 'chip-grey')}>
                    {machine.status_label}
                </span>
                {machine.kind_label && (
                    <span className="chip inline-flex items-center gap-1 bg-sidebar/10 text-sidebar">
                        <Truck size={12} />
                        {machine.kind_label}
                    </span>
                )}
                <span className="chip chip-grey">{machine.ownership_label}</span>
                {machine.service_status !== 'ok' && machine.next_service_on && (
                    <span className={clsx('chip inline-flex items-center gap-1', DATE_BADGE[machine.service_status].className)}>
                        <Wrench size={12} />
                        Szerviz: {DATE_BADGE[machine.service_status].label.toLowerCase()}
                    </span>
                )}
                {machine.inspection_status !== 'ok' && machine.inspection_valid_until && (
                    <span className={clsx('chip inline-flex items-center gap-1', DATE_BADGE[machine.inspection_status].className)}>
                        <CalendarClock size={12} />
                        Vizsga: {DATE_BADGE[machine.inspection_status].label.toLowerCase()}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Bal oszlop: adatok */}
                <div className="space-y-5 lg:col-span-1">
                    <div className="o-card p-5">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Törzsadatok
                        </h2>
                        <div className="space-y-3.5">
                            {machine.identifier && (
                                <InfoRow icon={Hash} label="Azonosító / rendszám">
                                    {machine.identifier}
                                </InfoRow>
                            )}
                            <InfoRow icon={CalendarDays} label="Gyártási év / beszerzés">
                                {[
                                    machine.manufacture_year ? String(machine.manufacture_year) : null,
                                    machine.purchased_on ? fmtDate(machine.purchased_on) : null,
                                ]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                            </InfoRow>
                            <InfoRow icon={Truck} label="Tulajdon">
                                {machine.ownership_label}
                                {machine.ownership === 'berelt' && machine.rental_source && (
                                    <span className="ml-1 font-normal text-ink-soft">
                                        · {machine.rental_source}
                                    </span>
                                )}
                            </InfoRow>
                            <InfoRow icon={MapPin} label="Aktuális hely">
                                {machine.location || '—'}
                            </InfoRow>
                            <InfoRow icon={UserIcon} label="Felelős / kezelő">
                                {machine.responsible_name || '—'}
                            </InfoRow>
                        </div>
                    </div>

                    <div className="o-card p-5">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Karbantartás / vizsga
                        </h2>
                        <div className="space-y-4">
                            <DeadlineRow
                                icon={Wrench}
                                label="Következő szerviz"
                                date={machine.next_service_on}
                                status={machine.service_status}
                            />
                            <DeadlineRow
                                icon={CalendarClock}
                                label="Műszaki vizsga érvényessége"
                                date={machine.inspection_valid_until}
                                status={machine.inspection_status}
                            />
                            <InfoRow icon={FileText} label="Karbantartási költség összesen">
                                {fmtHuf(current_maintenance_cost)}
                            </InfoRow>
                        </div>
                    </div>

                    {machine.note && (
                        <div className="o-card p-5">
                            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                                <FileText size={14} />
                                Megjegyzés
                            </h2>
                            <p className="whitespace-pre-line text-sm text-ink-soft">{machine.note}</p>
                        </div>
                    )}
                </div>

                {/* Jobb oszlop */}
                <div className="space-y-5 lg:col-span-2">
                    {/* Foglalások */}
                    <div className="o-card">
                        <CardHeader icon={FolderKanban} title="Foglalások / projektbeosztás" count={bookings.length} />
                        <div className="divide-y divide-line">
                            {bookings.map((b) => (
                                <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {b.project ? (
                                                <Link
                                                    href={route('projects.show', b.project.id)}
                                                    className="flex items-center gap-2 hover:text-accent"
                                                >
                                                    <span className="font-mono text-xs text-ink-faint">
                                                        {b.project.code}
                                                    </span>
                                                    <span className="text-sm font-medium text-ink">
                                                        {b.project.name}
                                                    </span>
                                                </Link>
                                            ) : (
                                                <span className="text-sm text-ink-faint">Törölt projekt</span>
                                            )}
                                            {b.is_current && <span className="chip chip-green">Most itt</span>}
                                            {b.is_conflicted && (
                                                <span className="chip inline-flex items-center gap-1 bg-coral/15 text-coral">
                                                    <TriangleAlert size={11} />
                                                    Ütközés
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                                            <span className="inline-flex items-center gap-1">
                                                <CalendarDays size={12} />
                                                {fmtDate(b.starts_on)} → {fmtDate(b.ends_on)}
                                            </span>
                                            {b.note && <span>{b.note}</span>}
                                        </div>
                                    </div>
                                    {canEdit && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Törli ezt a foglalást?')) {
                                                    router.delete(
                                                        route('machines.bookings.destroy', b.id),
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
                            {bookings.length === 0 && (
                                <p className="px-5 py-6 text-center text-sm text-ink-faint">
                                    Nincs rögzített foglalás.
                                </p>
                            )}
                        </div>

                        {canEdit && assignable_projects.length > 0 && (
                            <form
                                onSubmit={submitBooking}
                                className="flex flex-col gap-2 border-t border-line bg-cream/30 px-5 py-3 sm:flex-row sm:flex-wrap sm:items-end"
                            >
                                <select
                                    value={bookingForm.data.project_id}
                                    onChange={(e) => bookingForm.setData('project_id', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 sm:w-48"
                                >
                                    <option value="">Projekt kiválasztása…</option>
                                    {assignable_projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.code} – {p.name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="date"
                                    value={bookingForm.data.starts_on}
                                    onChange={(e) => bookingForm.setData('starts_on', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <input
                                    type="date"
                                    value={bookingForm.data.ends_on}
                                    onChange={(e) => bookingForm.setData('ends_on', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <button
                                    type="submit"
                                    className="btn-primary !py-1.5"
                                    disabled={
                                        bookingForm.processing ||
                                        !bookingForm.data.project_id ||
                                        !bookingForm.data.starts_on ||
                                        !bookingForm.data.ends_on
                                    }
                                >
                                    Foglalás
                                </button>
                            </form>
                        )}
                        {(bookingForm.errors.ends_on || bookingForm.errors.project_id) && (
                            <p className="px-5 pb-3 text-xs text-coral">
                                {bookingForm.errors.ends_on || bookingForm.errors.project_id}
                            </p>
                        )}
                    </div>

                    {/* Karbantartási előzmény */}
                    <div className="o-card">
                        <CardHeader
                            icon={Wrench}
                            title="Karbantartási előzmény"
                            count={maintenances.length}
                            action={
                                canEdit && (
                                    <button
                                        className="btn-ghost !py-1 text-xs"
                                        onClick={() => setMaintOpen(true)}
                                    >
                                        <Plus size={14} />
                                        Új
                                    </button>
                                )
                            }
                        />
                        <div className="divide-y divide-line">
                            {maintenances.map((m) => (
                                <div key={m.id} className="flex items-start gap-3 px-5 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="chip chip-grey">{m.type_label}</span>
                                            <span className="text-xs text-ink-faint">
                                                {fmtDate(m.performed_on)}
                                            </span>
                                            {m.cost != null && (
                                                <span className="text-xs font-medium text-ink-soft">
                                                    {fmtHuf(m.cost)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 whitespace-pre-line text-sm text-ink">
                                            {m.description}
                                        </p>
                                        <p className="mt-0.5 text-xs text-ink-faint">
                                            {m.creator_name ?? 'Ismeretlen'}
                                        </p>
                                    </div>
                                    {m.download_url && (
                                        <a
                                            href={m.download_url}
                                            className="btn-ghost !p-2"
                                            title={m.file_name ?? 'Letöltés'}
                                        >
                                            <Download size={15} />
                                        </a>
                                    )}
                                    {canEdit && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Törli ezt a bejegyzést?')) {
                                                    router.delete(
                                                        route('machines.maintenances.destroy', m.id),
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
                            {maintenances.length === 0 && (
                                <p className="px-5 py-6 text-center text-sm text-ink-faint">
                                    Még nincs karbantartási bejegyzés.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Dokumentumok */}
                    <div className="o-card">
                        <CardHeader icon={Paperclip} title="Dokumentumok" count={documents.length} />
                        <div className="divide-y divide-line">
                            {documents.map((d) => (
                                <div key={d.id} className="flex items-center gap-3 px-5 py-2.5">
                                    <FileText size={16} className="shrink-0 text-ink-faint" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium text-ink">
                                                {d.name}
                                            </span>
                                            <span className="chip chip-grey">{d.category_label}</span>
                                        </div>
                                        <div className="text-xs text-ink-faint">
                                            {fmtBytes(d.size_bytes)} · {d.uploader_name ?? '—'} ·{' '}
                                            {fmtDate(d.created_at)}
                                        </div>
                                    </div>
                                    <a href={d.download_url} className="btn-ghost !p-2" title="Letöltés">
                                        <Download size={15} />
                                    </a>
                                    {canEdit && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Törli ezt a fájlt?')) {
                                                    router.delete(
                                                        route('machines.documents.destroy', d.id),
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
                            {documents.length === 0 && (
                                <p className="px-5 py-6 text-center text-sm text-ink-faint">
                                    Nincs feltöltött dokumentum (gépkönyv, biztosítás, vizsgadok.).
                                </p>
                            )}
                        </div>

                        {canEdit && (
                            <form
                                onSubmit={submitDocs}
                                className="flex flex-col gap-2 border-t border-line bg-cream/30 px-5 py-3 sm:flex-row sm:items-center"
                            >
                                <select
                                    value={docForm.data.category}
                                    onChange={(e) => docForm.setData('category', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 sm:w-52"
                                >
                                    {Object.entries(doc_categories).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="file"
                                    multiple
                                    onChange={(e) =>
                                        docForm.setData('files', Array.from(e.target.files ?? []))
                                    }
                                    className="flex-1 text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-accent-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-700 hover:file:bg-accent-100"
                                />
                                <button
                                    type="submit"
                                    className="btn-primary !py-1.5"
                                    disabled={docForm.processing || docForm.data.files.length === 0}
                                >
                                    Feltöltés
                                </button>
                            </form>
                        )}
                        {docForm.errors.files && (
                            <p className="px-5 pb-3 text-xs text-coral">{docForm.errors.files}</p>
                        )}
                    </div>
                </div>
            </div>

            {editOpen && (
                <MachineModal
                    machine={machine}
                    kinds={kinds}
                    statuses={statuses}
                    ownership={ownership}
                    responsibleOptions={responsible_options}
                    canDelete={canDelete}
                    onClose={() => setEditOpen(false)}
                    onDelete={() => {
                        setEditOpen(false);
                        destroy();
                    }}
                />
            )}

            {maintOpen && (
                <MaintenanceModal
                    machineId={machine.id}
                    maintenanceTypes={maintenance_types}
                    onClose={() => setMaintOpen(false)}
                />
            )}
        </>
    );
}

Show.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
