import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { Lock, LockOpen } from 'lucide-react';
import type { AclEntry, Option } from '@/types/models';

interface PermissionsDialogProps {
    open: boolean;
    folder: { id: number; name: string; is_restricted: boolean; acl: AclEntry[] };
    users: Option[];
    onClose: () => void;
}

type Level = 'none' | 'view' | 'edit';

/**
 * Mappa-jogosultságok: korlátozás be/ki + felhasználónkénti szintek.
 * A korlátozás az almappákra és a bennük lévő fájlokra is öröklődik.
 */
export default function PermissionsDialog({
    open,
    folder,
    users,
    onClose,
}: PermissionsDialogProps) {
    const [restricted, setRestricted] = useState(folder.is_restricted);
    const [levels, setLevels] = useState<Record<number, Level>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (open) {
            setRestricted(folder.is_restricted);
            const initial: Record<number, Level> = {};
            for (const u of users) {
                const entry = folder.acl.find((e) => e.user_id === u.id);
                initial[u.id] = entry ? entry.access : 'none';
            }
            setLevels(initial);
        }
    }, [open, folder, users]);

    const save = () => {
        setBusy(true);
        router.put(
            route('folders.permissions', folder.id),
            {
                is_restricted: restricted,
                entries: Object.entries(levels)
                    .filter(([, level]) => level !== 'none')
                    .map(([userId, level]) => ({ user_id: Number(userId), access: level })),
            },
            {
                preserveScroll: true,
                onFinish: () => setBusy(false),
                onSuccess: onClose,
            },
        );
    };

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="o-card w-full max-w-md p-6">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-sidebar">
                        {restricted ? <Lock size={17} /> : <LockOpen size={17} />}
                        Jogosultságok — {folder.name}
                    </DialogTitle>

                    <label className="mt-4 flex items-start gap-2.5 rounded-md border border-line bg-cream/50 px-3 py-2.5">
                        <input
                            type="checkbox"
                            checked={restricted}
                            onChange={(e) => setRestricted(e.target.checked)}
                            className="mt-0.5 rounded-sm border-line text-accent focus:ring-accent/40"
                        />
                        <span className="text-sm">
                            <span className="font-medium text-ink">Korlátozott hozzáférés</span>
                            <span className="mt-0.5 block text-xs text-ink-soft">
                                Csak az alább kijelölt felhasználók (és az IT Admin) látják ezt a
                                mappát és a teljes tartalmát — az almappákra is érvényes.
                            </span>
                        </span>
                    </label>

                    {restricted && (
                        <div className="mt-3 divide-y divide-line rounded-md border border-line">
                            {users.map((u) => (
                                <div
                                    key={u.id}
                                    className="flex items-center justify-between gap-3 px-3 py-2"
                                >
                                    <span className="flex items-center gap-2 text-sm text-ink">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[10px] font-semibold text-white">
                                            {u.name
                                                .split(/\s+/)
                                                .slice(0, 2)
                                                .map((p) => p[0])
                                                .join('')
                                                .toUpperCase()}
                                        </span>
                                        {u.name}
                                    </span>
                                    <select
                                        value={levels[u.id] ?? 'none'}
                                        onChange={(e) =>
                                            setLevels((prev) => ({
                                                ...prev,
                                                [u.id]: e.target.value as Level,
                                            }))
                                        }
                                        className="rounded-md border-line bg-white py-1.5 text-xs focus:border-accent focus:ring-accent/30"
                                    >
                                        <option value="none">Nincs hozzáférés</option>
                                        <option value="view">Megtekintés</option>
                                        <option value="edit">Szerkesztés</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}

                    {restricted && (
                        <p className="mt-2 text-xs text-ink-faint">
                            A beállítást végző automatikusan szerkesztési jogot kap, hogy ne
                            zárhassa ki magát.
                        </p>
                    )}

                    <div className="mt-5 flex gap-2">
                        <button className="btn-primary" onClick={save} disabled={busy}>
                            Mentés
                        </button>
                        <button className="btn-ghost" onClick={onClose}>
                            Mégse
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
