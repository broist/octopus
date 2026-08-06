import { ReactNode, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    FolderOpen,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    Users,
    Wand2,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import InputLabel from '@/Components/ui/InputLabel';
import InputError from '@/Components/ui/InputError';
import MemberModal from '@/Pages/Finance/Partials/MemberModal';
import RecurringModal from '@/Pages/Finance/Partials/RecurringModal';
import { fmtMoney } from '@/Pages/Finance/Partials/ledger';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { LedgerMemberSetting, LedgerRecurring, LedgerWatch, Option } from '@/types/models';

interface SettingsProps extends Record<string, unknown> {
    members: LedgerMemberSetting[];
    recurring: LedgerRecurring[];
    users: Option[];
    folders: { id: number; label: string }[];
    watch: LedgerWatch;
    defaultMembers: { name: string; share: number }[];
    defaultWatchPath: string;
    categories: Record<string, string>;
    currencies: Record<string, string>;
    can: { edit: boolean; delete: boolean };
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

function Card({ title, icon: Icon, action, children }: {
    title: string;
    icon: typeof Users;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="o-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-sidebar">
                    <Icon size={16} />
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </div>
    );
}

export default function LedgerSettings() {
    const {
        members, recurring, users, folders, watch, defaultMembers, defaultWatchPath,
        categories, currencies, can,
    } = usePageProps<SettingsProps>();

    const [memberModal, setMemberModal] = useState<{ member: LedgerMemberSetting | null } | null>(null);
    const [recurringModal, setRecurringModal] = useState<{ item: LedgerRecurring | null } | null>(null);

    const watchForm = useForm<{ watch_folder_id: string }>({
        watch_folder_id: watch.folder_id != null ? String(watch.folder_id) : '',
    });

    const totalShare = members
        .filter((m) => m.is_active)
        .reduce((sum, m) => sum + m.default_share, 0);

    const saveWatch = (e: React.FormEvent) => {
        e.preventDefault();
        watchForm.transform((d) => ({
            watch_folder_id: d.watch_folder_id === '' ? null : d.watch_folder_id,
        }));
        watchForm.put(route('finance.ledger.settings.update'), { preserveScroll: true });
    };

    const removeMember = (member: LedgerMemberSetting) => {
        const message = member.has_history
            ? `„${member.name}” már szerepel elszámolásban, ezért törlés helyett inaktívvá válik. Folytatja?`
            : `Biztosan törli: ${member.name}?`;
        if (!confirm(message)) {
            return;
        }
        router.delete(route('finance.ledger.members.destroy', member.id), { preserveScroll: true });
    };

    const removeRecurring = (item: LedgerRecurring) => {
        if (!confirm(`Biztosan törli: ${item.title}?\n\nA már legenerált tételek megmaradnak.`)) {
            return;
        }
        router.delete(route('finance.ledger.recurring.destroy', item.id), { preserveScroll: true });
    };

    return (
        <>
            <Head title="Tagi kölcsön — beállítások" />

            <PageHeader
                title="Tagi kölcsön — beállítások"
                subtitle="Tagok és részesedésük, ismétlődő költségek, és a figyelt mappa a számla PDF-ekhez."
                actions={
                    <Link href={route('finance.ledger')} className="btn-ghost inline-flex items-center gap-1.5">
                        <ArrowLeft size={15} />
                        Vissza a nyilvántartáshoz
                    </Link>
                }
            />

            <div className="space-y-5">
                {/* --- Tagok --- */}
                <Card
                    title="Cégtagok és részesedésük"
                    icon={Users}
                    action={
                        can.edit && (
                            <div className="flex items-center gap-2">
                                {members.length === 0 && (
                                    <button
                                        type="button"
                                        className="btn-ghost inline-flex items-center gap-1.5 text-xs"
                                        onClick={() =>
                                            router.post(
                                                route('finance.ledger.members.seed'),
                                                {},
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        <Wand2 size={14} />
                                        Alapértelmezett tagok
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn-primary inline-flex items-center gap-1.5 text-xs"
                                    onClick={() => setMemberModal({ member: null })}
                                >
                                    <Plus size={14} />
                                    Új tag
                                </button>
                            </div>
                        )
                    }
                >
                    {members.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-ink-soft">
                            Még nincs felvett tag.
                            <div className="mt-1 text-xs text-ink-faint">
                                Az „Alapértelmezett tagok” gomb felveszi őket:{' '}
                                {defaultMembers.map((m) => `${m.name} ${m.share}%`).join(', ')}.
                            </div>
                        </div>
                    ) : (
                        <>
                            <ul className="divide-y divide-line">
                                {members.map((m) => (
                                    <li
                                        key={m.id}
                                        className={clsx(
                                            'flex items-center gap-3 px-5 py-3 text-sm',
                                            !m.is_active && 'opacity-60',
                                        )}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium text-ink">
                                                {m.name}
                                                {!m.is_active && (
                                                    <span className="ml-2 chip bg-cream text-ink-faint">
                                                        inaktív
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-ink-faint">
                                                {m.user_name
                                                    ? `Összekötve: ${m.user_name}`
                                                    : 'Nincs Octopus-fiókhoz kötve'}
                                            </div>
                                        </div>
                                        <span className="shrink-0 tabular-nums font-semibold text-sidebar">
                                            {m.default_share.toLocaleString('hu-HU')}%
                                        </span>
                                        {can.edit && (
                                            <button
                                                type="button"
                                                onClick={() => setMemberModal({ member: m })}
                                                title="Szerkesztés"
                                                className="rounded-md p-1.5 text-ink-faint transition hover:bg-cream hover:text-accent"
                                            >
                                                <Pencil size={15} />
                                            </button>
                                        )}
                                        {can.delete && (
                                            <button
                                                type="button"
                                                onClick={() => removeMember(m)}
                                                title={m.has_history ? 'Inaktiválás' : 'Törlés'}
                                                className="rounded-md p-1.5 text-ink-faint transition hover:bg-coral/10 hover:text-coral"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <div
                                className={clsx(
                                    'border-t border-line px-5 py-2.5 text-xs',
                                    Math.abs(totalShare - 100) < 0.001
                                        ? 'text-ink-faint'
                                        : 'text-amber-600',
                                )}
                            >
                                Az aktív tagok részesedése összesen:{' '}
                                {totalShare.toLocaleString('hu-HU')}%
                                {Math.abs(totalShare - 100) >= 0.001 &&
                                    ' — nem 100%, ezért a felosztás arányosítva történik.'}
                            </div>
                        </>
                    )}
                </Card>

                {/* --- Figyelt mappa --- */}
                <Card title="Figyelt mappa (számla PDF-ek)" icon={FolderOpen}>
                    <div className="px-5 py-4">
                        <p className="text-sm text-ink-soft">
                            Az ide feltöltött PDF-számlákból automatikusan keletkezik egy esedékes
                            befizetés-sor, a tagokra lebontva. A rendszer kiolvassa belőle az
                            elszámolási hónapot, a fizetési határidőt és a végösszeget.
                        </p>

                        <form onSubmit={saveWatch} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1">
                                <InputLabel value="Mappa" />
                                <select
                                    value={watchForm.data.watch_folder_id}
                                    onChange={(e) => watchForm.setData('watch_folder_id', e.target.value)}
                                    className={selectClass}
                                    disabled={!can.edit}
                                >
                                    <option value="">
                                        — automatikus: {defaultWatchPath} —
                                    </option>
                                    {folders.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={watchForm.errors.watch_folder_id} />
                            </div>
                            {can.edit && (
                                <button
                                    type="submit"
                                    className="btn-primary shrink-0"
                                    disabled={watchForm.processing}
                                >
                                    Mentés
                                </button>
                            )}
                        </form>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                            {watch.path ? (
                                <>
                                    <span className="text-ink-soft">Jelenleg figyelve:</span>
                                    <Link
                                        href={watch.url ?? '#'}
                                        className="font-medium text-accent hover:underline"
                                    >
                                        {watch.path}
                                    </Link>
                                    {watch.is_default && (
                                        <span className="chip bg-cream text-ink-faint">
                                            alapértelmezett útvonal alapján
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-amber-700">
                                    Nincs figyelt mappa — az alapértelmezett útvonal (
                                    {defaultWatchPath}) nem található, válasszon mappát a listából.
                                </span>
                            )}
                        </div>

                        <button
                            type="button"
                            className="btn-ghost mt-3 inline-flex items-center gap-1.5"
                            onClick={() =>
                                router.post(route('finance.ledger.scan'), {}, { preserveScroll: true })
                            }
                        >
                            <RefreshCw size={15} />
                            Beolvasás most
                        </button>
                    </div>
                </Card>

                {/* --- Ismétlődő költségek --- */}
                <Card
                    title="Ismétlődő közös költségek"
                    icon={RefreshCw}
                    action={
                        can.edit && (
                            <button
                                type="button"
                                className="btn-primary inline-flex items-center gap-1.5 text-xs"
                                onClick={() => setRecurringModal({ item: null })}
                                disabled={members.length === 0}
                            >
                                <Plus size={14} />
                                Új ismétlődő
                            </button>
                        )
                    }
                >
                    {recurring.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-ink-soft">
                            Nincs ismétlődő költség.
                            <div className="mt-1 text-xs text-ink-faint">
                                Ide való például a havi ChatGPT-előfizetés — megadható, kiket érint és
                                a hónap hányadikán esedékes.
                            </div>
                        </div>
                    ) : (
                        <ul className="divide-y divide-line">
                            {recurring.map((r) => (
                                <li
                                    key={r.id}
                                    className={clsx(
                                        'flex items-center gap-3 px-5 py-3 text-sm',
                                        !r.is_active && 'opacity-60',
                                    )}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium text-ink">
                                            {r.title}
                                            {!r.is_active && (
                                                <span className="ml-2 chip bg-cream text-ink-faint">
                                                    szünetel
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-ink-faint">
                                            {r.category_label} · minden hónap {r.due_day}. napján ·{' '}
                                            {r.shares.length} tag
                                            {r.last_period && (
                                                <> · utoljára: {fmtDate(r.last_period)}</>
                                            )}
                                        </div>
                                    </div>
                                    <span className="shrink-0 tabular-nums font-semibold text-sidebar">
                                        {fmtMoney(r.amount, r.currency)}
                                    </span>
                                    {can.edit && (
                                        <button
                                            type="button"
                                            onClick={() => setRecurringModal({ item: r })}
                                            title="Szerkesztés"
                                            className="rounded-md p-1.5 text-ink-faint transition hover:bg-cream hover:text-accent"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                    )}
                                    {can.delete && (
                                        <button
                                            type="button"
                                            onClick={() => removeRecurring(r)}
                                            title="Törlés"
                                            className="rounded-md p-1.5 text-ink-faint transition hover:bg-coral/10 hover:text-coral"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {memberModal && (
                <MemberModal
                    member={memberModal.member}
                    users={users}
                    onClose={() => setMemberModal(null)}
                />
            )}

            {recurringModal && (
                <RecurringModal
                    recurring={recurringModal.item}
                    members={members}
                    categories={categories}
                    currencies={currencies}
                    onClose={() => setRecurringModal(null)}
                />
            )}
        </>
    );
}

LedgerSettings.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
