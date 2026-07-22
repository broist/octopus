import { ReactNode, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    CalendarClock,
    Download,
    FileText,
    FolderKanban,
    Hash,
    HardHat,
    Mail,
    MapPin,
    Paperclip,
    Pencil,
    Phone,
    Plus,
    Star,
    Trash2,
    TriangleAlert,
    User as UserIcon,
    Users,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StatusChip from '@/Components/StatusChip';
import SubcontractorModal from '@/Pages/Subcontractors/Partials/SubcontractorModal';
import CertificationModal from '@/Pages/Subcontractors/Partials/CertificationModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate, fmtBytes } from '@/lib/format';
import type {
    CertStatus,
    SubAssignedProject,
    SubCertification,
    SubDocument,
    SubcontractorDetail,
    SubRating,
} from '@/types/models';

interface ShowProps extends Record<string, unknown> {
    subcontractor: SubcontractorDetail;
    certifications: SubCertification[];
    ratings: SubRating[];
    avg_rating: number | null;
    documents: SubDocument[];
    assigned_projects: SubAssignedProject[];
    assignable_projects: { id: number; code: string; name: string }[];
    trades: Record<string, string>;
    cert_types: Record<string, string>;
    doc_categories: Record<string, string>;
}

const CERT_BADGE: Record<CertStatus, { label: string; className: string }> = {
    ok: { label: 'Érvényes', className: 'chip-green' },
    soon: { label: 'Hamarosan lejár', className: 'chip-amber' },
    expired: { label: 'Lejárt', className: 'bg-coral/15 text-coral' },
};

function InfoRow({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof Mail;
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

function Stars({ score, size = 14 }: { score: number; size?: number }) {
    return (
        <span className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <Star
                    key={n}
                    size={size}
                    className={
                        n <= Math.round(score)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-line'
                    }
                />
            ))}
        </span>
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
                    <span className="rounded-sm bg-cream px-1.5 py-0.5 text-xs text-ink-faint">
                        {count}
                    </span>
                )}
            </h2>
            {action}
        </div>
    );
}

export default function Show() {
    const {
        subcontractor: sub,
        certifications,
        ratings,
        avg_rating,
        documents,
        assigned_projects,
        assignable_projects,
        trades,
        cert_types,
        doc_categories,
        auth,
    } = usePageProps<ShowProps>();

    const canEdit = auth.permissions.includes('subcontractors.edit');
    const canDelete = auth.permissions.includes('subcontractors.delete');

    const [editOpen, setEditOpen] = useState(false);
    const [certModalOpen, setCertModalOpen] = useState(false);

    // Értékelés-űrlap
    const ratingForm = useForm<{ score: number; project_id: string; comment: string }>({
        score: 5,
        project_id: '',
        comment: '',
    });
    // Dokumentum-feltöltés
    const docForm = useForm<{ category: string; files: File[] }>({
        category: 'szerzodes',
        files: [],
    });
    // Projekt-hozzárendelés
    const projForm = useForm<{ project_id: string; scope: string; note: string }>({
        project_id: '',
        scope: '',
        note: '',
    });

    const destroy = () => {
        if (confirm(`Biztosan archiválja ${sub.name} alvállalkozót?`)) {
            router.delete(route('subcontractors.destroy', sub.id));
        }
    };

    const submitRating = (e: React.FormEvent) => {
        e.preventDefault();
        ratingForm.post(route('subcontractors.ratings.store', sub.id), {
            preserveScroll: true,
            onSuccess: () => ratingForm.reset(),
        });
    };

    const submitDocs = (e: React.FormEvent) => {
        e.preventDefault();
        docForm.post(route('subcontractors.documents.store', sub.id), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => docForm.reset('files'),
        });
    };

    const submitProject = (e: React.FormEvent) => {
        e.preventDefault();
        projForm.post(route('subcontractors.projects.attach', sub.id), {
            preserveScroll: true,
            onSuccess: () => projForm.reset(),
        });
    };

    const hasContact = sub.email || sub.phone || sub.contact_name || sub.address || sub.tax_id;

    return (
        <>
            <Head title={sub.name} />

            <Link
                href={route('subcontractors.index')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza az alvállalkozókhoz
            </Link>

            <PageHeader
                title={sub.name}
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
                <span
                    className={clsx(
                        'chip inline-flex items-center gap-1',
                        sub.is_company ? 'bg-accent-50 text-accent-700' : 'bg-sidebar/10 text-sidebar',
                    )}
                >
                    {sub.is_company ? <Building2 size={12} /> : <UserIcon size={12} />}
                    {sub.is_company ? 'Cég' : 'Magánszemély'}
                </span>
                {sub.trade_label && (
                    <span className="chip inline-flex items-center gap-1 bg-sidebar/10 text-sidebar">
                        <HardHat size={12} />
                        {sub.trade_label}
                    </span>
                )}
                {avg_rating !== null && (
                    <span className="inline-flex items-center gap-1.5">
                        <Stars score={avg_rating} />
                        <span className="text-xs text-ink-soft">{avg_rating.toFixed(1)} / 5</span>
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Bal oszlop: adatok */}
                <div className="space-y-5 lg:col-span-1">
                    <div className="o-card p-5">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Kapcsolati adatok
                        </h2>
                        {hasContact ? (
                            <div className="space-y-3.5">
                                {sub.contact_name && (
                                    <InfoRow icon={UserIcon} label="Kapcsolattartó">
                                        {sub.contact_name}
                                    </InfoRow>
                                )}
                                {sub.email && (
                                    <InfoRow icon={Mail} label="E-mail">
                                        <a
                                            href={`mailto:${sub.email}`}
                                            className="text-accent hover:underline"
                                        >
                                            {sub.email}
                                        </a>
                                    </InfoRow>
                                )}
                                {sub.phone && (
                                    <InfoRow icon={Phone} label="Telefon">
                                        <a
                                            href={`tel:${sub.phone}`}
                                            className="text-accent hover:underline"
                                        >
                                            {sub.phone}
                                        </a>
                                    </InfoRow>
                                )}
                                {sub.tax_id && (
                                    <InfoRow icon={Hash} label="Adószám">
                                        {sub.tax_id}
                                    </InfoRow>
                                )}
                                {sub.address && (
                                    <InfoRow icon={MapPin} label="Székhely / cím">
                                        {sub.address}
                                    </InfoRow>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-ink-faint">Nincs rögzített kapcsolati adat.</p>
                        )}
                    </div>

                    <div className="o-card p-5">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Kapacitás
                        </h2>
                        <div className="space-y-3.5">
                            <InfoRow icon={Users} label="Létszám">
                                {sub.crew_size != null ? `${sub.crew_size} fő` : '—'}
                            </InfoRow>
                            {sub.availability_note && (
                                <InfoRow icon={CalendarClock} label="Elérhetőség">
                                    <span className="whitespace-pre-line font-normal text-ink-soft">
                                        {sub.availability_note}
                                    </span>
                                </InfoRow>
                            )}
                        </div>
                    </div>

                    {sub.note && (
                        <div className="o-card p-5">
                            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                                <FileText size={14} />
                                Megjegyzés
                            </h2>
                            <p className="whitespace-pre-line text-sm text-ink-soft">{sub.note}</p>
                        </div>
                    )}
                </div>

                {/* Jobb oszlop */}
                <div className="space-y-5 lg:col-span-2">
                    {/* Tanúsítványok / dokumentumok lejárattal */}
                    <div className="o-card">
                        <CardHeader
                            icon={TriangleAlert}
                            title="Jogi / adminisztratív dokumentumok"
                            count={certifications.length}
                            action={
                                canEdit && (
                                    <button
                                        className="btn-ghost !py-1 text-xs"
                                        onClick={() => setCertModalOpen(true)}
                                    >
                                        <Plus size={14} />
                                        Új
                                    </button>
                                )
                            }
                        />
                        {certifications.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-ink-faint">
                                Nincs rögzített szerződés, biztosítás vagy tanúsítvány.
                            </p>
                        ) : (
                            <div className="divide-y divide-line">
                                {certifications.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-3 px-5 py-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-medium text-ink">
                                                    {c.name}
                                                </span>
                                                <span className="chip chip-grey">{c.type_label}</span>
                                                <span className={clsx('chip', CERT_BADGE[c.status].className)}>
                                                    {CERT_BADGE[c.status].label}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                                                {c.issuer && <span>{c.issuer}</span>}
                                                {c.valid_until && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <CalendarClock size={12} />
                                                        Lejárat: {fmtDate(c.valid_until)}
                                                    </span>
                                                )}
                                                {c.note && <span>{c.note}</span>}
                                            </div>
                                        </div>
                                        {c.download_url && (
                                            <a
                                                href={c.download_url}
                                                className="btn-ghost !p-2"
                                                title={c.file_name ?? 'Letöltés'}
                                            >
                                                <Download size={15} />
                                            </a>
                                        )}
                                        {canEdit && (
                                            <button
                                                onClick={() => {
                                                    if (confirm('Törli ezt a dokumentumot?')) {
                                                        router.delete(
                                                            route('subcontractors.certifications.destroy', c.id),
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

                    {/* Értékelések */}
                    <div className="o-card">
                        <CardHeader
                            icon={Star}
                            title="Teljesítmény-értékelés"
                            count={ratings.length}
                            action={
                                avg_rating !== null && (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                                        <Stars score={avg_rating} size={13} />
                                        {avg_rating.toFixed(1)}
                                    </span>
                                )
                            }
                        />
                        <div className="divide-y divide-line">
                            {ratings.map((r) => (
                                <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Stars score={r.score} size={13} />
                                            {r.project && (
                                                <Link
                                                    href={route('projects.show', r.project.id)}
                                                    className="chip chip-grey hover:text-accent"
                                                >
                                                    {r.project.code}
                                                </Link>
                                            )}
                                        </div>
                                        {r.comment && (
                                            <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
                                                {r.comment}
                                            </p>
                                        )}
                                        <p className="mt-0.5 text-xs text-ink-faint">
                                            {r.rater_name ?? 'Ismeretlen'} · {fmtDate(r.created_at)}
                                        </p>
                                    </div>
                                    {canEdit && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Törli ezt az értékelést?')) {
                                                    router.delete(
                                                        route('subcontractors.ratings.destroy', r.id),
                                                        { preserveScroll: true },
                                                    );
                                                }
                                            }}
                                            className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                            title="Törlés"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {ratings.length === 0 && (
                                <p className="px-5 py-6 text-center text-sm text-ink-faint">
                                    Még nincs értékelés.
                                </p>
                            )}
                        </div>

                        {canEdit && (
                            <form
                                onSubmit={submitRating}
                                className="flex flex-col gap-2 border-t border-line bg-cream/30 px-5 py-3 sm:flex-row sm:items-center"
                            >
                                <select
                                    value={ratingForm.data.score}
                                    onChange={(e) => ratingForm.setData('score', Number(e.target.value))}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                >
                                    {[5, 4, 3, 2, 1].map((n) => (
                                        <option key={n} value={n}>
                                            {'★'.repeat(n)} ({n})
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={ratingForm.data.project_id}
                                    onChange={(e) => ratingForm.setData('project_id', e.target.value)}
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 sm:w-40"
                                >
                                    <option value="">Projekt (opcionális)</option>
                                    {assigned_projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.code}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={ratingForm.data.comment}
                                    onChange={(e) => ratingForm.setData('comment', e.target.value)}
                                    placeholder="Megjegyzés…"
                                    className="flex-1 rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <button
                                    type="submit"
                                    className="btn-primary !py-1.5"
                                    disabled={ratingForm.processing}
                                >
                                    Értékelek
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Dokumentumok (fájlok) */}
                    <div className="o-card">
                        <CardHeader icon={Paperclip} title="Csatolt dokumentumok" count={documents.length} />
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
                                                        route('subcontractors.documents.destroy', d.id),
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
                                    Nincs feltöltött dokumentum.
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
                                    className="rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30 sm:w-44"
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

                    {/* Projekt-hozzárendelés */}
                    <div className="o-card">
                        <CardHeader
                            icon={FolderKanban}
                            title="Projektek"
                            count={assigned_projects.length}
                        />
                        <div className="divide-y divide-line">
                            {assigned_projects.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                                    <Link
                                        href={route('projects.show', p.id)}
                                        className="flex min-w-0 flex-1 items-center gap-3 hover:text-accent"
                                    >
                                        <span className="font-mono text-xs text-ink-faint">{p.code}</span>
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                                            {p.name}
                                            {p.scope && (
                                                <span className="ml-2 text-xs font-normal text-ink-faint">
                                                    · {p.scope}
                                                </span>
                                            )}
                                        </span>
                                        <StatusChip status={p.status} />
                                    </Link>
                                    {canEdit && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Eltávolítja a projekt-hozzárendelést?')) {
                                                    router.delete(
                                                        route('subcontractors.projects.detach', [sub.id, p.id]),
                                                        { preserveScroll: true },
                                                    );
                                                }
                                            }}
                                            className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                            title="Eltávolítás"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {assigned_projects.length === 0 && (
                                <p className="px-5 py-6 text-center text-sm text-ink-faint">
                                    Nincs projekthez rendelve.
                                </p>
                            )}
                        </div>

                        {canEdit && assignable_projects.length > 0 && (
                            <form
                                onSubmit={submitProject}
                                className="flex flex-col gap-2 border-t border-line bg-cream/30 px-5 py-3 sm:flex-row sm:items-center"
                            >
                                <select
                                    value={projForm.data.project_id}
                                    onChange={(e) => projForm.setData('project_id', e.target.value)}
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
                                    type="text"
                                    value={projForm.data.scope}
                                    onChange={(e) => projForm.setData('scope', e.target.value)}
                                    placeholder="Milyen feladaton…"
                                    className="flex-1 rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                />
                                <button
                                    type="submit"
                                    className="btn-primary !py-1.5"
                                    disabled={projForm.processing || !projForm.data.project_id}
                                >
                                    Hozzárendel
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {editOpen && (
                <SubcontractorModal
                    subcontractor={sub}
                    trades={trades}
                    canDelete={canDelete}
                    onClose={() => setEditOpen(false)}
                    onDelete={() => {
                        setEditOpen(false);
                        destroy();
                    }}
                />
            )}

            {certModalOpen && (
                <CertificationModal
                    partnerId={sub.id}
                    certTypes={cert_types}
                    onClose={() => setCertModalOpen(false)}
                />
            )}
        </>
    );
}

Show.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
