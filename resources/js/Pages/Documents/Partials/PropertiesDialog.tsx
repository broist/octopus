import { useCallback, useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import {
    Cloud,
    Folder as FolderIcon,
    HardDrive,
    Info,
    Lock,
    LockOpen,
    Server,
    Trash2,
    UserPlus,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import { fmtBytes, fmtDateTime } from '@/lib/format';
import { fileIcon } from '@/lib/documents';
import { fileKind } from '@/Pages/Documents/Partials/explorer';
import type { Option } from '@/types/models';

type Level = 'view' | 'edit';

interface AclRow {
    user_id: number;
    name: string;
    access: Level;
}

interface FolderProps {
    type: 'folder';
    id: number;
    name: string;
    path: string;
    parent_id: number | null;
    created_at: string | null;
    updated_at: string | null;
    owner: string | null;
    folder_count: number;
    file_count: number;
    size_bytes: number;
    is_restricted: boolean;
    access_level: 'view' | 'edit' | null;
    can_manage_permissions: boolean;
    can_edit: boolean;
    acl: AclRow[];
    inherited_from: { id: number; name: string; acl: AclRow[] } | null;
}

interface FileProps {
    type: 'file';
    id: number;
    name: string;
    path: string;
    folder_id: number | null;
    filename: string | null;
    mime_type: string | null;
    size_bytes: number;
    category: string;
    category_label: string;
    description: string | null;
    version_number: number;
    version_count: number;
    created_at: string | null;
    updated_at: string | null;
    owner: string | null;
    project: string | null;
    partner: string | null;
    stored_in_cloud: boolean;
    download_version_id: number | null;
    can_edit: boolean;
    can_delete: boolean;
    folder: {
        id: number;
        name: string;
        is_restricted: boolean;
        can_manage_permissions: boolean;
    } | null;
}

type Props = FolderProps | FileProps;

interface PropertiesDialogProps {
    target: { type: 'folder' | 'file'; id: number } | null;
    users: Option[];
    /** Fájl tulajdonságairól átlépés a befoglaló mappa tulajdonságaira. */
    onNavigate: (target: { type: 'folder' | 'file'; id: number }) => void;
    onClose: () => void;
}

const initials = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();

/** Egy „címke — érték” sor a Windows tulajdonságlap mintájára. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-3 border-b border-line/60 py-1.5 last:border-0">
            <span className="w-32 shrink-0 text-xs text-ink-faint">{label}</span>
            <span className="min-w-0 flex-1 break-words text-[13px] text-ink">{children}</span>
        </div>
    );
}

/**
 * Windows-stílusú Tulajdonságok lap: Általános + Biztonság (jogosultságok)
 * fülekkel, mappára és fájlra egyaránt.
 */
export default function PropertiesDialog({
    target,
    users,
    onNavigate,
    onClose,
}: PropertiesDialogProps) {
    const [data, setData] = useState<Props | null>(null);
    const [tab, setTab] = useState<'general' | 'security'>('general');
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);

    /* Szerkeszthető állapot */
    const [name, setName] = useState('');
    const [restricted, setRestricted] = useState(false);
    const [acl, setAcl] = useState<AclRow[]>([]);
    const [addUser, setAddUser] = useState('');

    const load = useCallback(async () => {
        if (!target) return;
        setLoading(true);
        try {
            const res = await fetch(route('file-ops.properties', target), {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            const json: Props = await res.json();
            setData(json);
            setName(json.name);
            if (json.type === 'folder') {
                setRestricted(json.is_restricted);
                setAcl(json.acl);
            }
        } finally {
            setLoading(false);
        }
    }, [target]);

    useEffect(() => {
        setData(null);
        setTab('general');
        setAddUser('');
        void load();
    }, [load]);

    const dirty =
        !!data &&
        (name.trim() !== data.name ||
            (data.type === 'folder' &&
                (restricted !== data.is_restricted ||
                    JSON.stringify([...acl].sort((a, b) => a.user_id - b.user_id)) !==
                        JSON.stringify([...data.acl].sort((a, b) => a.user_id - b.user_id)))));

    const apply = (thenClose: boolean) => {
        if (!data) return;
        setBusy(true);

        const finish = () => {
            setBusy(false);
            if (thenClose) onClose();
            else void load();
        };

        const savePermissions = () => {
            if (data.type !== 'folder' || !data.can_manage_permissions) return finish();
            router.put(
                route('folders.permissions', data.id),
                {
                    is_restricted: restricted,
                    entries: acl.map((e) => ({ user_id: e.user_id, access: e.access })),
                },
                { preserveScroll: true, onFinish: finish },
            );
        };

        if (name.trim() && name.trim() !== data.name) {
            const url =
                data.type === 'folder'
                    ? route('folders.update', data.id)
                    : route('documents.update', data.id);
            const payload =
                data.type === 'folder'
                    ? { name: name.trim() }
                    : { title: name.trim(), category: data.category };

            router.put(url, payload, {
                preserveScroll: true,
                onSuccess: savePermissions,
                onError: () => setBusy(false),
            });
            return;
        }

        savePermissions();
    };

    const canManage = data?.type === 'folder' && data.can_manage_permissions;
    const available = users.filter((u) => !acl.some((e) => e.user_id === u.id));

    const icon = () => {
        if (!data) return <FolderIcon size={40} className="text-ink-faint" strokeWidth={1} />;
        if (data.type === 'folder') {
            return (
                <FolderIcon size={40} className="text-[#E8B04B]" fill="#F3CE84" strokeWidth={1} />
            );
        }
        const Icon = fileIcon(data.mime_type, data.filename);
        return <Icon size={38} className="text-accent" strokeWidth={1.2} />;
    };

    return (
        <Dialog open={target !== null} onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[8px] border border-line bg-white shadow-[0_12px_40px_rgba(33,56,46,0.25)]">
                    {/* Fejléc */}
                    <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                        <span className="shrink-0">{icon()}</span>
                        <div className="min-w-0 flex-1">
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={!data || !data.can_edit}
                                className="w-full rounded-[3px] border-line bg-white px-2 py-1 text-sm font-semibold text-sidebar focus:border-accent focus:ring-accent/30 disabled:border-transparent disabled:bg-transparent disabled:px-0"
                            />
                            <p className="mt-0.5 truncate px-0.5 text-xs text-ink-faint">
                                {data?.path ?? 'Betöltés…'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="shrink-0 rounded-[4px] p-1 text-ink-faint hover:bg-cream hover:text-ink"
                            aria-label="Bezárás"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Fülek */}
                    <div className="flex gap-1 border-b border-line bg-cream/40 px-3 pt-2">
                        {(
                            [
                                ['general', 'Általános'],
                                ['security', 'Biztonság'],
                            ] as const
                        ).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={clsx(
                                    'rounded-t-[4px] border border-b-0 px-3 py-1.5 text-[13px] transition',
                                    tab === key
                                        ? 'border-line bg-white font-medium text-sidebar'
                                        : 'border-transparent text-ink-soft hover:text-ink',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Tartalom */}
                    <div className="min-h-[240px] flex-1 overflow-y-auto px-5 py-3">
                        {!data ? (
                            <p className="py-8 text-center text-sm text-ink-faint">
                                {loading ? 'Betöltés…' : 'Nincs adat.'}
                            </p>
                        ) : tab === 'general' ? (
                            <div>
                                {data.type === 'folder' ? (
                                    <>
                                        <Row label="Típus">Fájlmappa</Row>
                                        <Row label="Hely">{data.path}</Row>
                                        <Row label="Tartalom">
                                            {data.file_count} fájl, {data.folder_count} almappa
                                        </Row>
                                        <Row label="Méret">
                                            {data.size_bytes ? fmtBytes(data.size_bytes) : '0 B'}
                                        </Row>
                                        <Row label="Létrehozva">{fmtDateTime(data.created_at)}</Row>
                                        <Row label="Módosítva">{fmtDateTime(data.updated_at)}</Row>
                                        <Row label="Létrehozta">{data.owner ?? '–'}</Row>
                                        <Row label="Hozzáférés">
                                            <span className="flex items-center gap-1.5">
                                                {data.is_restricted || data.inherited_from ? (
                                                    <>
                                                        <Lock size={13} className="text-amberwarn" />
                                                        Korlátozott
                                                        {data.inherited_from &&
                                                            !data.is_restricted &&
                                                            ` (örökölt: ${data.inherited_from.name})`}
                                                    </>
                                                ) : (
                                                    <>
                                                        <LockOpen size={13} className="text-ink-faint" />
                                                        Nyitott (a modul-jogosultságok szerint)
                                                    </>
                                                )}
                                            </span>
                                        </Row>
                                    </>
                                ) : (
                                    <>
                                        <Row label="Típus">
                                            {fileKind(data.mime_type, data.filename)}
                                        </Row>
                                        <Row label="Fájlnév">{data.filename ?? '–'}</Row>
                                        <Row label="Hely">{data.path}</Row>
                                        <Row label="Méret">{fmtBytes(data.size_bytes)}</Row>
                                        <Row label="Kategória">{data.category_label}</Row>
                                        <Row label="Projekt">{data.project ?? '–'}</Row>
                                        <Row label="Partner">{data.partner ?? '–'}</Row>
                                        <Row label="Verziók">
                                            {data.version_count} db (aktuális: v{data.version_number})
                                        </Row>
                                        <Row label="Feltöltve">{fmtDateTime(data.created_at)}</Row>
                                        <Row label="Módosítva">{fmtDateTime(data.updated_at)}</Row>
                                        <Row label="Feltöltötte">{data.owner ?? '–'}</Row>
                                        <Row label="Tárolás">
                                            <span className="flex items-center gap-1.5">
                                                {data.stored_in_cloud ? (
                                                    <>
                                                        <Cloud size={13} /> Felhőtárhely
                                                    </>
                                                ) : (
                                                    <>
                                                        <Server size={13} /> Szerver
                                                    </>
                                                )}
                                            </span>
                                        </Row>
                                        {data.description && (
                                            <Row label="Megjegyzés">{data.description}</Row>
                                        )}
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                className="btn-ghost !py-1.5 text-xs"
                                                onClick={() =>
                                                    router.get(route('documents.show', data.id))
                                                }
                                            >
                                                Adatlap megnyitása
                                            </button>
                                            {data.download_version_id && (
                                                <a
                                                    className="btn-ghost !py-1.5 text-xs"
                                                    href={route(
                                                        'documents.versions.download',
                                                        data.download_version_id,
                                                    )}
                                                >
                                                    Letöltés
                                                </a>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : /* ---------------- BIZTONSÁG ---------------- */
                        data.type === 'file' ? (
                            <div className="space-y-3">
                                <div className="flex gap-2 rounded-[4px] border border-line bg-cream/50 px-3 py-2.5 text-xs text-ink-soft">
                                    <Info size={15} className="mt-0.5 shrink-0 text-ink-faint" />
                                    <p>
                                        A fájl hozzáférését a befoglaló mappa jogosultsága
                                        határozza meg — a beállítás a mappán öröklődik lefelé.
                                    </p>
                                </div>
                                <Row label="Mappa">{data.folder?.name ?? 'Fájlok (gyökér)'}</Row>
                                <Row label="Mappa állapota">
                                    {data.folder?.is_restricted
                                        ? 'Korlátozott hozzáférés'
                                        : 'Nincs saját korlátozás'}
                                </Row>
                                {data.folder && (
                                    <button
                                        className="btn-ghost !py-1.5 text-xs"
                                        onClick={() =>
                                            onNavigate({ type: 'folder', id: data.folder!.id })
                                        }
                                    >
                                        <Lock size={13} />
                                        Mappa jogosultságai…
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.inherited_from && (
                                    <div className="flex gap-2 rounded-[4px] border border-line bg-cream/50 px-3 py-2.5 text-xs text-ink-soft">
                                        <Info size={15} className="mt-0.5 shrink-0 text-ink-faint" />
                                        <div>
                                            <p>
                                                Örökölt korlátozás a(z){' '}
                                                <span className="font-medium text-ink">
                                                    {data.inherited_from.name}
                                                </span>{' '}
                                                mappától. Az itteni beállítás csak szűkíthet, nem
                                                bővíthet.
                                            </p>
                                            {data.inherited_from.acl.length > 0 && (
                                                <p className="mt-1">
                                                    Örökölt jogosultak:{' '}
                                                    {data.inherited_from.acl
                                                        .map(
                                                            (e) =>
                                                                `${e.name} (${
                                                                    e.access === 'edit'
                                                                        ? 'szerkesztés'
                                                                        : 'megtekintés'
                                                                })`,
                                                        )
                                                        .join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <label
                                    className={clsx(
                                        'flex items-start gap-2.5 rounded-[4px] border border-line px-3 py-2.5',
                                        canManage ? 'bg-white' : 'bg-cream/50',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={restricted}
                                        disabled={!canManage}
                                        onChange={(e) => setRestricted(e.target.checked)}
                                        className="mt-0.5 rounded-sm border-line text-accent focus:ring-accent/40"
                                    />
                                    <span className="text-sm">
                                        <span className="font-medium text-ink">
                                            Korlátozott hozzáférés
                                        </span>
                                        <span className="mt-0.5 block text-xs text-ink-soft">
                                            Csak az alább felsorolt felhasználók (és az IT Admin)
                                            látják a mappát és a teljes tartalmát; a korlátozás az
                                            almappákra is érvényes.
                                        </span>
                                    </span>
                                </label>

                                {restricted && (
                                    <div className="rounded-[4px] border border-line">
                                        <div className="flex items-center justify-between border-b border-line bg-cream/50 px-3 py-1.5 text-xs font-medium text-ink-soft">
                                            <span>Jogosultak ({acl.length})</span>
                                            <span>Szint</span>
                                        </div>

                                        {acl.length === 0 && (
                                            <p className="px-3 py-3 text-center text-xs text-ink-faint">
                                                Még nincs felvéve senki — adjon hozzá
                                                felhasználókat alul.
                                            </p>
                                        )}

                                        <div className="divide-y divide-line">
                                            {acl.map((entry) => (
                                                <div
                                                    key={entry.user_id}
                                                    className="flex items-center gap-2 px-3 py-1.5"
                                                >
                                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-accent text-[10px] font-semibold text-white">
                                                        {initials(entry.name)}
                                                    </span>
                                                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                                                        {entry.name}
                                                    </span>
                                                    <select
                                                        value={entry.access}
                                                        disabled={!canManage}
                                                        onChange={(e) =>
                                                            setAcl((prev) =>
                                                                prev.map((row) =>
                                                                    row.user_id === entry.user_id
                                                                        ? {
                                                                              ...row,
                                                                              access: e.target
                                                                                  .value as Level,
                                                                          }
                                                                        : row,
                                                                ),
                                                            )
                                                        }
                                                        className="rounded-[3px] border-line bg-white py-1 text-xs focus:border-accent focus:ring-accent/30"
                                                    >
                                                        <option value="view">Megtekintés</option>
                                                        <option value="edit">Szerkesztés</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        disabled={!canManage}
                                                        onClick={() =>
                                                            setAcl((prev) =>
                                                                prev.filter(
                                                                    (row) =>
                                                                        row.user_id !==
                                                                        entry.user_id,
                                                                ),
                                                            )
                                                        }
                                                        className="rounded-[3px] p-1 text-ink-faint hover:bg-cream hover:text-coral disabled:opacity-40"
                                                        aria-label="Eltávolítás"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {canManage && (
                                            <div className="flex items-center gap-2 border-t border-line bg-cream/40 px-3 py-2">
                                                <UserPlus size={14} className="text-ink-faint" />
                                                <select
                                                    value={addUser}
                                                    onChange={(e) => {
                                                        const id = Number(e.target.value);
                                                        const user = users.find((u) => u.id === id);
                                                        if (user) {
                                                            setAcl((prev) => [
                                                                ...prev,
                                                                {
                                                                    user_id: user.id,
                                                                    name: user.name,
                                                                    access: 'view',
                                                                },
                                                            ]);
                                                        }
                                                        setAddUser('');
                                                    }}
                                                    className="flex-1 rounded-[3px] border-line bg-white py-1 text-xs focus:border-accent focus:ring-accent/30"
                                                >
                                                    <option value="">
                                                        Felhasználó hozzáadása…
                                                    </option>
                                                    {available.map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {restricted && canManage && (
                                    <p className="text-xs text-ink-faint">
                                        A beállítást végző automatikusan szerkesztési jogot kap,
                                        hogy ne zárhassa ki magát.
                                    </p>
                                )}

                                {!canManage && (
                                    <p className="text-xs text-ink-faint">
                                        Ezen a mappán nincs jogosultsága a hozzáférés
                                        módosítására.
                                    </p>
                                )}

                                <div className="flex items-center gap-1.5 pt-1 text-xs text-ink-faint">
                                    <HardDrive size={13} />
                                    Az Ön szintje itt:{' '}
                                    {data.access_level === 'edit'
                                        ? 'szerkesztés'
                                        : data.access_level === 'view'
                                          ? 'megtekintés'
                                          : 'a modul-jogosultság szerint'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lábléc */}
                    <div className="flex justify-end gap-2 border-t border-line bg-cream/40 px-5 py-3">
                        <button
                            className="btn-primary !py-1.5 text-[13px]"
                            disabled={busy || !dirty}
                            onClick={() => apply(true)}
                        >
                            OK
                        </button>
                        <button className="btn-ghost !py-1.5 text-[13px]" onClick={onClose}>
                            Mégse
                        </button>
                        <button
                            className="btn-ghost !py-1.5 text-[13px]"
                            disabled={busy || !dirty}
                            onClick={() => apply(false)}
                        >
                            Alkalmaz
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
