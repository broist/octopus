import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    Mail,
    Pencil,
    Phone,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    UserPlus,
    Users as UsersIcon,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';
import type { ManagedUser } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    users: ManagedUser[];
    roles: string[];
    filters: { search: string };
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

/* ------------------------------------------------------------------ */
/* Munkatárs felvevő / szerkesztő modal                                */
/* ------------------------------------------------------------------ */

interface UserFormData {
    name: string;
    email: string;
    job_title: string;
    phone: string;
    role: string;
    password: string;
    password_confirmation: string;
    is_active: boolean;
    is_external: boolean;
    [key: string]: string | boolean;
}

function UserModal({
    user,
    roles,
    canDelete,
    onClose,
}: {
    user: ManagedUser | null;
    roles: string[];
    canDelete: boolean;
    onClose: () => void;
}) {
    const form = useForm<UserFormData>({
        name: user?.name ?? '',
        email: user?.email ?? '',
        job_title: user?.job_title ?? '',
        phone: user?.phone ?? '',
        role: user?.role ?? '',
        password: '',
        password_confirmation: '',
        is_active: user?.is_active ?? true,
        is_external: user?.is_external ?? false,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (user) {
            form.put(route('users.update', user.id), options);
        } else {
            form.post(route('users.store'), options);
        }
    };

    const destroy = () => {
        if (user && confirm(`Biztosan törli ${user.name} fiókját? Ez nem vonható vissza.`)) {
            router.delete(route('users.destroy', user.id), {
                preserveScroll: true,
                onSuccess: onClose,
            });
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {user ? 'Munkatárs szerkesztése' : 'Új munkatárs'}
                    </DialogTitle>
                    <p className="mt-1 text-sm text-ink-soft">
                        {user
                            ? 'Módosítsa az adatokat vagy a szerepkört. A jelszót csak akkor töltse ki, ha újat ad.'
                            : 'Vegye fel a munkatársat — ezekkel az adatokkal fog belépni a rendszerbe.'}
                    </p>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Név *" />
                                <TextInput
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    isFocused
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.name} />
                            </div>
                            <div>
                                <InputLabel value="Beosztás" />
                                <TextInput
                                    value={form.data.job_title}
                                    onChange={(e) => form.setData('job_title', e.target.value)}
                                    placeholder="pl. Művezető"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.job_title} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="E-mail cím *" />
                                <TextInput
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.email} />
                            </div>
                            <div>
                                <InputLabel value="Telefonszám" />
                                <TextInput
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    placeholder="+36 …"
                                    autoComplete="off"
                                />
                                <InputError message={form.errors.phone} />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Szerepkör" />
                            <select
                                value={form.data.role}
                                onChange={(e) => form.setData('role', e.target.value)}
                                className={selectClass}
                            >
                                <option value="">– Nincs szerepkör –</option>
                                {roles.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors.role} />
                            <p className="mt-1 text-xs text-ink-faint">
                                A szerepkör határozza meg, mely modulokat láthatja és
                                szerkesztheti a munkatárs.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value={user ? 'Új jelszó' : 'Jelszó *'} />
                                <TextInput
                                    type="password"
                                    value={form.data.password}
                                    onChange={(e) => form.setData('password', e.target.value)}
                                    autoComplete="new-password"
                                    placeholder={user ? 'Változatlan, ha üres' : ''}
                                />
                                <InputError message={form.errors.password} />
                            </div>
                            <div>
                                <InputLabel value="Jelszó megerősítése" />
                                <TextInput
                                    type="password"
                                    value={form.data.password_confirmation}
                                    onChange={(e) =>
                                        form.setData('password_confirmation', e.target.value)
                                    }
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 rounded-lg border border-line bg-cream/50 p-3">
                            <label className="flex items-center gap-2 text-sm text-ink">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_active}
                                    onChange={(e) => form.setData('is_active', e.target.checked)}
                                    className="rounded border-line text-accent focus:ring-accent/40"
                                />
                                Aktív fiók (beléphet a rendszerbe)
                            </label>
                            <label className="flex items-center gap-2 text-sm text-ink">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_external}
                                    onChange={(e) => form.setData('is_external', e.target.checked)}
                                    className="rounded border-line text-accent focus:ring-accent/40"
                                />
                                Külső hozzáférés (megrendelői portál – menü nélkül)
                            </label>
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {user ? 'Mentés' : 'Munkatárs felvétele'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                            {user && canDelete && !user.is_self && (
                                <button
                                    type="button"
                                    onClick={destroy}
                                    className="btn ml-auto inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                    title="Munkatárs törlése"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}

/* ------------------------------------------------------------------ */
/* Oldal                                                               */
/* ------------------------------------------------------------------ */

export default function Index() {
    const { users, roles, filters, auth } = usePageProps<IndexProps>();

    const canCreate = auth.permissions.includes('users.create');
    const canEdit = auth.permissions.includes('users.edit');
    const canDelete = auth.permissions.includes('users.delete');

    const [modal, setModal] = useState<{ user: ManagedUser | null } | null>(null);
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('users.index'),
                { search: search || undefined },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const toggleActive = (user: ManagedUser) => {
        router.put(route('users.active', user.id), {}, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Munkatársak" />

            <PageHeader
                title="Munkatársak"
                subtitle="Vegye fel a csapatát, adjon nekik szerepkört és belépési adatokat."
                actions={
                    canCreate && (
                        <button className="btn-primary" onClick={() => setModal({ user: null })}>
                            <UserPlus size={16} />
                            Új munkatárs
                        </button>
                    )
                }
            />

            {/* Kereső */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Keresés név, e-mail, beosztás szerint…"
                        className="w-full rounded-lg border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
                <span className="text-sm text-ink-faint sm:ml-auto">
                    {users.length} munkatárs
                </span>
            </div>

            {users.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <UsersIcon size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">
                        Nincs a keresésnek megfelelő munkatárs
                    </h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search
                            ? 'Módosítsa a keresési feltételt.'
                            : 'Vegye fel az első munkatársat a jobb felső gombbal.'}
                    </p>
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {users.map((u) => (
                        <div
                            key={u.id}
                            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                        >
                            {/* Avatar + név */}
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span
                                    className={clsx(
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
                                        u.is_active
                                            ? 'bg-accent text-white'
                                            : 'bg-line text-ink-faint',
                                    )}
                                >
                                    {u.initials}
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-ink">
                                            {u.name}
                                        </span>
                                        {u.is_self && (
                                            <span className="chip chip-grey">Ön</span>
                                        )}
                                        {u.is_external && (
                                            <span className="chip chip-amber">Külső</span>
                                        )}
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faint">
                                        <span className="flex items-center gap-1">
                                            <Mail size={12} />
                                            <span className="truncate">{u.email}</span>
                                        </span>
                                        {u.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone size={12} />
                                                {u.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Beosztás / szerepkör */}
                            <div className="flex flex-wrap items-center gap-2 sm:w-64 sm:justify-start">
                                {u.job_title && (
                                    <span className="text-sm text-ink-soft">{u.job_title}</span>
                                )}
                                {u.role && (
                                    <span className="chip inline-flex items-center gap-1 bg-accent-50 text-accent-700">
                                        <ShieldCheck size={12} />
                                        {u.role}
                                    </span>
                                )}
                            </div>

                            {/* Állapot + műveletek */}
                            <div className="flex items-center gap-2 sm:justify-end">
                                {canEdit && !u.is_self ? (
                                    <button
                                        type="button"
                                        onClick={() => toggleActive(u)}
                                        className={clsx(
                                            'chip cursor-pointer select-none',
                                            u.is_active
                                                ? 'bg-accent-50 text-accent-700 hover:bg-accent-100'
                                                : 'chip-grey hover:bg-line',
                                        )}
                                        title={
                                            u.is_active
                                                ? 'Kattintson a deaktiváláshoz'
                                                : 'Kattintson az aktiváláshoz'
                                        }
                                    >
                                        {u.is_active ? 'Aktív' : 'Inaktív'}
                                    </button>
                                ) : (
                                    <span
                                        className={clsx(
                                            'chip',
                                            u.is_active
                                                ? 'bg-accent-50 text-accent-700'
                                                : 'chip-grey',
                                        )}
                                    >
                                        {u.is_active ? 'Aktív' : 'Inaktív'}
                                    </span>
                                )}

                                {canEdit && (
                                    <button
                                        type="button"
                                        onClick={() => setModal({ user: u })}
                                        className="rounded-lg p-2 text-ink-soft hover:bg-cream hover:text-ink"
                                        title="Szerkesztés"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal && (
                <UserModal
                    user={modal.user}
                    roles={roles}
                    canDelete={canDelete}
                    onClose={() => setModal(null)}
                />
            )}

            {!canCreate && !canEdit && (
                <p className="mt-4 flex items-center gap-2 text-sm text-ink-faint">
                    <Plus size={14} />
                    Munkatárs felvételéhez adminisztrátori jogosultság szükséges.
                </p>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
