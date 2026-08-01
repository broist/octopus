import { FormEventHandler, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import { KeyRound, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import clsx from 'clsx';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { fmtDate } from '@/lib/format';
import type { PortalAccessUser } from '@/types/models';

interface Props {
    partnerId: number;
    partnerName: string;
    contactName: string | null;
    email: string | null;
    users: PortalAccessUser[];
    can: { create: boolean; edit: boolean; delete: boolean };
}

/** Véletlenszerű, kimondható kezdeti jelszó — az admin adja át az ügyfélnek. */
function suggestPassword(): string {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Ügyfélportál-hozzáférés a partner adatlapján.
 *
 * A megrendelő nem regisztrál magának: itt kap fiókot, amivel a
 * cloud.acuwall.hu/ugyfel oldalon léphet be. A belépési adatokat az
 * adminisztrátor adja át neki — a rendszer nem küld e-mailt.
 */
export default function PortalAccessCard({
    partnerId,
    partnerName,
    contactName,
    email,
    users,
    can,
}: Props) {
    const [open, setOpen] = useState(false);

    const form = useForm({
        name: contactName ?? partnerName,
        email: email ?? '',
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('crm.portal.store', partnerId), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setOpen(false);
            },
        });
    };

    const toggleActive = (user: PortalAccessUser) => {
        router.put(
            route('crm.portal.update', [partnerId, user.id]),
            { name: user.name, email: user.email, is_active: !user.is_active },
            { preserveScroll: true },
        );
    };

    const resetPassword = (user: PortalAccessUser) => {
        const next = suggestPassword();
        if (
            !confirm(
                `${user.name} új jelszava:\n\n${next}\n\nMásolja ki és adja át neki — utána nem lesz újra megjeleníthető. Beállítja?`,
            )
        ) {
            return;
        }

        router.put(
            route('crm.portal.update', [partnerId, user.id]),
            { name: user.name, email: user.email, is_active: user.is_active, password: next },
            { preserveScroll: true },
        );
    };

    const revoke = (user: PortalAccessUser) => {
        if (confirm(`Visszavonja ${user.name} portál-hozzáférését? A fiókja törlődik.`)) {
            router.delete(route('crm.portal.destroy', [partnerId, user.id]), {
                preserveScroll: true,
            });
        }
    };

    return (
        <div className="o-card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                        Ügyfélportál
                    </h2>
                    <p className="mt-1 text-xs text-ink-faint">
                        Belépés a megosztott projektekhez, dokumentumokhoz és árajánlatokhoz.
                    </p>
                </div>
                {can.create && !open && (
                    <button
                        type="button"
                        className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
                        onClick={() => {
                            form.setData('password', suggestPassword());
                            setOpen(true);
                        }}
                    >
                        <Plus size={14} />
                        Hozzáférés
                    </button>
                )}
            </div>

            {users.length === 0 && !open ? (
                <p className="text-sm text-ink-faint">
                    Ennek a partnernek még nincs portál-belépése.
                </p>
            ) : (
                <div className="space-y-2">
                    {users.map((u) => (
                        <div
                            key={u.id}
                            className="flex items-center gap-2 rounded-md border border-line px-3 py-2"
                        >
                            <span
                                className={clsx(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
                                    u.is_active
                                        ? 'bg-accent-50 text-accent'
                                        : 'bg-line text-ink-faint',
                                )}
                            >
                                {u.is_active ? <UserCheck size={15} /> : <UserX size={15} />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-ink">
                                    {u.name}
                                </div>
                                <div className="truncate text-xs text-ink-faint">
                                    {u.email}
                                    {u.created_at && ` · ${fmtDate(u.created_at)}`}
                                </div>
                            </div>

                            {!u.is_active && <span className="chip chip-grey shrink-0">Kikapcsolva</span>}

                            {can.edit && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => resetPassword(u)}
                                        className="shrink-0 rounded p-1.5 text-ink-faint hover:bg-cream hover:text-accent"
                                        title="Új jelszó beállítása"
                                    >
                                        <KeyRound size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => toggleActive(u)}
                                        className="shrink-0 rounded p-1.5 text-ink-faint hover:bg-cream hover:text-accent"
                                        title={u.is_active ? 'Kikapcsolás' : 'Bekapcsolás'}
                                    >
                                        {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                                    </button>
                                </>
                            )}
                            {can.delete && (
                                <button
                                    type="button"
                                    onClick={() => revoke(u)}
                                    className="shrink-0 rounded p-1.5 text-ink-faint hover:bg-coral/10 hover:text-coral"
                                    title="Hozzáférés visszavonása"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {open && (
                <form onSubmit={submit} className="mt-4 space-y-3 border-t border-line pt-4">
                    <div>
                        <InputLabel htmlFor="portal_name" value="Kapcsolattartó neve" />
                        <TextInput
                            id="portal_name"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div>
                        <InputLabel htmlFor="portal_email" value="E-mail cím (belépési név)" />
                        <TextInput
                            id="portal_email"
                            type="email"
                            value={form.data.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                        />
                        <InputError message={form.errors.email} />
                    </div>
                    <div>
                        <InputLabel htmlFor="portal_password" value="Kezdeti jelszó" />
                        <TextInput
                            id="portal_password"
                            value={form.data.password}
                            onChange={(e) => form.setData('password', e.target.value)}
                        />
                        <InputError message={form.errors.password} />
                        <p className="mt-1 text-xs text-ink-faint">
                            A rendszer nem küld e-mailt — a belépési adatokat Ön adja át. Az
                            ügyfél a portálon bármikor megváltoztathatja a jelszavát.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="btn-primary px-3 py-1.5 text-xs" disabled={form.processing}>
                            Hozzáférés létrehozása
                        </button>
                        <button
                            type="button"
                            className="btn-ghost px-3 py-1.5 text-xs"
                            onClick={() => {
                                form.reset();
                                form.clearErrors();
                                setOpen(false);
                            }}
                        >
                            Mégsem
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
