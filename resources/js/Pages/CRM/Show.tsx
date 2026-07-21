import { ReactNode, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    FileText,
    FolderKanban,
    Hash,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Sparkles,
    Trash2,
    User as UserIcon,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StatusChip from '@/Components/StatusChip';
import PartnerModal from '@/Pages/CRM/Partials/PartnerModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { PartnerDetail, PartnerProjectRow } from '@/types/models';

interface ShowProps extends Record<string, unknown> {
    partner: PartnerDetail;
    projects: PartnerProjectRow[];
}

const ROLE_CHIP: Record<string, string> = {
    Megrendelő: 'bg-accent-50 text-accent-700',
    Beszállító: 'chip-amber',
    Alvállalkozó: 'bg-sidebar/10 text-sidebar',
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

export default function Show() {
    const { partner, projects, auth } = usePageProps<ShowProps>();
    const canEdit = auth.permissions.includes('crm.edit');
    const canDelete = auth.permissions.includes('crm.delete');

    const [editOpen, setEditOpen] = useState(false);

    const roles = {
        is_client: 'Megrendelő',
        is_supplier: 'Beszállító',
        is_subcontractor: 'Alvállalkozó',
    };

    const destroy = () => {
        if (confirm(`Biztosan archiválja ${partner.name} partnert?`)) {
            router.delete(route('crm.destroy', partner.id));
        }
    };

    const hasContact = partner.email || partner.phone || partner.contact_name || partner.address;

    return (
        <>
            <Head title={partner.name} />

            <Link
                href={route('crm.index')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza a partnerekhez
            </Link>

            <PageHeader
                title={partner.name}
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
                        partner.is_company
                            ? 'bg-accent-50 text-accent-700'
                            : 'bg-sidebar/10 text-sidebar',
                    )}
                >
                    {partner.is_company ? <Building2 size={12} /> : <UserIcon size={12} />}
                    {partner.is_company ? 'Cég' : 'Magánszemély'}
                </span>
                {partner.roles.map((r) => (
                    <span key={r} className={clsx('chip', ROLE_CHIP[r] ?? 'chip-grey')}>
                        {r}
                    </span>
                ))}
                {partner.source === 'lead' && (
                    <span className="chip inline-flex items-center gap-1 bg-accent-50 text-accent-700">
                        <Sparkles size={11} />
                        Ajánlatkérésből érkezett
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Kapcsolati adatok */}
                <div className="space-y-5 lg:col-span-1">
                    <div className="o-card p-5">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            Kapcsolati adatok
                        </h2>
                        {hasContact ? (
                            <div className="space-y-3.5">
                                {partner.contact_name && (
                                    <InfoRow icon={UserIcon} label="Kapcsolattartó">
                                        {partner.contact_name}
                                    </InfoRow>
                                )}
                                {partner.email && (
                                    <InfoRow icon={Mail} label="E-mail">
                                        <a
                                            href={`mailto:${partner.email}`}
                                            className="text-accent hover:underline"
                                        >
                                            {partner.email}
                                        </a>
                                    </InfoRow>
                                )}
                                {partner.phone && (
                                    <InfoRow icon={Phone} label="Telefon">
                                        <a
                                            href={`tel:${partner.phone}`}
                                            className="text-accent hover:underline"
                                        >
                                            {partner.phone}
                                        </a>
                                    </InfoRow>
                                )}
                                {partner.tax_id && (
                                    <InfoRow icon={Hash} label="Adószám">
                                        {partner.tax_id}
                                    </InfoRow>
                                )}
                                {partner.address && (
                                    <InfoRow icon={MapPin} label="Cím">
                                        {partner.address}
                                    </InfoRow>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-ink-faint">
                                Nincs rögzített kapcsolati adat.
                            </p>
                        )}
                    </div>

                    {partner.note && (
                        <div className="o-card p-5">
                            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                                <FileText size={14} />
                                Megjegyzés
                            </h2>
                            <p className="whitespace-pre-line text-sm text-ink-soft">
                                {partner.note}
                            </p>
                        </div>
                    )}
                </div>

                {/* Kapcsolt projektek */}
                <div className="lg:col-span-2">
                    <div className="o-card">
                        <div className="flex items-center justify-between border-b border-line px-5 py-3">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-sidebar">
                                <FolderKanban size={16} />
                                Projektek megrendelőként
                                <span className="rounded-sm bg-cream px-1.5 py-0.5 text-xs text-ink-faint">
                                    {projects.length}
                                </span>
                            </h2>
                        </div>

                        {projects.length === 0 ? (
                            <div className="px-5 py-12 text-center">
                                <p className="text-sm text-ink-soft">
                                    Ehhez a partnerhez még nincs projekt megrendelőként rendelve.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-line">
                                {projects.map((p) => (
                                    <Link
                                        key={p.id}
                                        href={route('projects.show', p.id)}
                                        className="flex items-center gap-3 px-5 py-3 transition hover:bg-cream/50"
                                    >
                                        <span className="font-mono text-xs text-ink-faint">
                                            {p.code}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                                            {p.name}
                                        </span>
                                        {p.pm_name && (
                                            <span className="hidden text-xs text-ink-faint md:block">
                                                {p.pm_name}
                                            </span>
                                        )}
                                        <span className="hidden text-xs text-ink-faint lg:block">
                                            {fmtDate(p.starts_on)}
                                        </span>
                                        <StatusChip status={p.status} />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {editOpen && (
                <PartnerModal
                    partner={partner}
                    roles={roles}
                    canDelete={canDelete}
                    onClose={() => setEditOpen(false)}
                    onDelete={() => {
                        setEditOpen(false);
                        destroy();
                    }}
                />
            )}
        </>
    );
}

Show.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
