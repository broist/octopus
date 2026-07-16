import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    Camera,
    ChevronRight,
    Download,
    ExternalLink,
    Folder as FolderIcon,
    FolderInput,
    FolderPlus,
    HardDrive,
    Image as ImageIcon,
    LayoutGrid,
    Lock,
    MoreVertical,
    Pencil,
    Rows3,
    Search,
    Trash2,
    Upload,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import ContextMenu, { MenuItem } from '@/Pages/Documents/Partials/ContextMenu';
import FolderTree from '@/Pages/Documents/Partials/FolderTree';
import MoveDialog from '@/Pages/Documents/Partials/MoveDialog';
import NameDialog from '@/Pages/Documents/Partials/NameDialog';
import PermissionsDialog from '@/Pages/Documents/Partials/PermissionsDialog';
import UploadDialog from '@/Pages/Documents/Partials/UploadDialog';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtBytes, fmtDate } from '@/lib/format';
import { CATEGORY_LABELS, fileIcon } from '@/lib/documents';
import type {
    AclEntry,
    ExplorerFileRow,
    ExplorerFolderRow,
    FolderCrumb,
    Option,
    ProjectOption,
    TreeFolder,
} from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    folderId: number | null;
    breadcrumbs: FolderCrumb[];
    folders: ExplorerFolderRow[];
    documents: ExplorerFileRow[];
    tree: TreeFolder[];
    can: { create: boolean; edit: boolean; delete: boolean; manage_permissions: boolean };
    currentFolder: {
        id: number;
        name: string;
        is_restricted: boolean;
        acl: AclEntry[];
    } | null;
    users: Option[];
    categories: Record<string, string>;
    projects: ProjectOption[];
    filters: { search: string; category: string; project: number | null };
    searchMode: boolean;
}

type Item =
    | { type: 'folder'; row: ExplorerFolderRow }
    | { type: 'file'; row: ExplorerFileRow };

const toolbarBtn =
    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-cream hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent';

export default function Index() {
    const props = usePageProps<IndexProps>();
    const {
        folderId,
        breadcrumbs,
        folders,
        documents,
        tree,
        can,
        currentFolder,
        users,
        categories,
        projects,
        filters,
        searchMode,
    } = props;
    const pageErrors = (props.errors ?? {}) as Record<string, string>;

    const coarse = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
        [],
    );

    /* ---------------- nézet + kijelölés ---------------- */
    const [view, setView] = useState<'grid' | 'details'>(
        () => (localStorage.getItem('octopus.files.view') as 'grid' | 'details') ?? 'grid',
    );
    useEffect(() => localStorage.setItem('octopus.files.view', view), [view]);

    const [selected, setSelected] = useState<{ type: string; id: number } | null>(null);
    const [dragOverFolder, setDragOverFolder] = useState<number | null | 'root'>(null);

    /* ---------------- keresés ---------------- */
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('documents.index'),
                {
                    ...(search ? { search } : {}),
                    ...(!search && folderId ? { folder: folderId } : {}),
                },
                { preserveState: true, replace: true },
            );
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    /* ---------------- dialógusok ---------------- */
    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<Item | null>(null);
    const [moveTarget, setMoveTarget] = useState<Item | null>(null);
    const [permsTarget, setPermsTarget] = useState<{
        id: number;
        name: string;
        is_restricted: boolean;
        acl: AclEntry[];
    } | null>(null);
    const [uploadFiles, setUploadFiles] = useState<File[] | null>(null);
    const [menu, setMenu] = useState<{ x: number; y: number; item: Item | null } | null>(null);
    const [busy, setBusy] = useState(false);

    /* ---------------- fájl-bemenetek (fájl / galéria / kamera) ---------------- */
    const fileInput = useRef<HTMLInputElement>(null);
    const galleryInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);

    const onFilesPicked = (list: FileList | null) => {
        if (list && list.length > 0) setUploadFiles(Array.from(list));
    };

    /* ---------------- műveletek ---------------- */
    const goto = (id: number | null) => {
        setSelected(null);
        router.get(route('documents.index'), id ? { folder: id } : {});
    };

    const openItem = (item: Item) => {
        if (item.type === 'folder') goto(item.row.id);
        else router.get(route('documents.show', item.row.id));
    };

    const visitOptions = {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    };

    const createFolder = (name: string) => {
        router.post(
            route('folders.store'),
            { name, parent_id: folderId },
            { ...visitOptions, onSuccess: () => setNewFolderOpen(false) },
        );
    };

    const renameItem = (name: string) => {
        if (!renameTarget) return;
        if (renameTarget.type === 'folder') {
            router.put(
                route('folders.update', renameTarget.row.id),
                { name },
                { ...visitOptions, onSuccess: () => setRenameTarget(null) },
            );
        } else {
            router.put(
                route('documents.update', renameTarget.row.id),
                { title: name, category: renameTarget.row.category },
                { ...visitOptions, onSuccess: () => setRenameTarget(null) },
            );
        }
    };

    const moveItem = (item: Item, targetId: number | null) => {
        if (item.type === 'folder') {
            router.put(
                route('folders.move', item.row.id),
                { parent_id: targetId },
                { ...visitOptions, onSuccess: () => setMoveTarget(null) },
            );
        } else {
            router.put(
                route('documents.move', item.row.id),
                { folder_id: targetId },
                { ...visitOptions, onSuccess: () => setMoveTarget(null) },
            );
        }
    };

    const deleteItem = (item: Item) => {
        if (item.type === 'folder') {
            if (confirm(`Biztosan törli a(z) „${item.row.name}" mappát?`)) {
                router.delete(route('folders.destroy', item.row.id), visitOptions);
            }
        } else if (confirm(`Biztosan törli a(z) „${item.row.title}" fájlt?`)) {
            router.delete(route('documents.destroy', item.row.id), visitOptions);
        }
    };

    /* ---------------- drag & drop ---------------- */
    const onItemDragStart = (item: Item, e: React.DragEvent) => {
        e.dataTransfer.setData(
            'application/x-octopus-item',
            JSON.stringify({ type: item.type, id: item.row.id }),
        );
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (targetId: number | null, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolder(null);
        try {
            const payload = JSON.parse(e.dataTransfer.getData('application/x-octopus-item'));
            if (payload.type === 'folder') {
                if (payload.id === targetId) return;
                router.put(route('folders.move', payload.id), { parent_id: targetId }, visitOptions);
            } else if (payload.type === 'file') {
                router.put(route('documents.move', payload.id), { folder_id: targetId }, visitOptions);
            }
        } catch {
            /* nem a mi elemünk */
        }
    };

    const dropProps = (targetId: number | null, key: number | 'root') => ({
        onDragOver: (e: React.DragEvent) => {
            if (e.dataTransfer.types.includes('application/x-octopus-item')) {
                e.preventDefault();
                setDragOverFolder(key);
            }
        },
        onDragLeave: () => setDragOverFolder(null),
        onDrop: (e: React.DragEvent) => handleDrop(targetId, e),
    });

    /* ---------------- helyi menü ---------------- */
    const menuItemsFor = (item: Item | null): MenuItem[] => {
        if (!item) {
            return [
                { label: 'Új mappa', icon: FolderPlus, disabled: !can.create, onClick: () => setNewFolderOpen(true) },
                { label: 'Fájl feltöltése', icon: Upload, disabled: !can.create, onClick: () => fileInput.current?.click() },
            ];
        }

        if (item.type === 'folder') {
            const row = item.row;
            return [
                { label: 'Megnyitás', icon: FolderIcon, onClick: () => goto(row.id) },
                { label: 'Átnevezés', icon: Pencil, disabled: !can.edit, onClick: () => setRenameTarget(item) },
                { label: 'Áthelyezés…', icon: FolderInput, disabled: !can.edit, onClick: () => setMoveTarget(item) },
                {
                    label: 'Jogosultságok…',
                    icon: Lock,
                    disabled: !row.can_manage_permissions,
                    onClick: () =>
                        setPermsTarget({
                            id: row.id,
                            name: row.name,
                            is_restricted: row.is_restricted,
                            acl: row.acl,
                        }),
                },
                { label: 'Törlés', icon: Trash2, danger: true, disabled: !can.delete, onClick: () => deleteItem(item) },
            ];
        }

        const row = item.row;
        return [
            { label: 'Megnyitás', icon: ExternalLink, onClick: () => openItem(item) },
            {
                label: 'Letöltés',
                icon: Download,
                disabled: !row.download_version_id,
                onClick: () => {
                    if (row.download_version_id) {
                        window.location.href = route('documents.versions.download', row.download_version_id);
                    }
                },
            },
            { label: 'Átnevezés', icon: Pencil, disabled: !can.edit, onClick: () => setRenameTarget(item) },
            { label: 'Áthelyezés…', icon: FolderInput, disabled: !can.edit, onClick: () => setMoveTarget(item) },
            { label: 'Törlés', icon: Trash2, danger: true, disabled: !can.delete, onClick: () => deleteItem(item) },
        ];
    };

    const openMenu = (item: Item | null, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY, item });
        if (item) setSelected({ type: item.type, id: item.row.id });
    };

    /* ---------------- elem-kattintás (Windows: klikk=kijelöl, dupla=nyit) ---------------- */
    const itemClick = (item: Item) => {
        if (coarse) openItem(item);
        else setSelected({ type: item.type, id: item.row.id });
    };

    const isSelected = (item: Item) =>
        selected?.type === item.type && selected?.id === item.row.id;

    /* ================================================================== */

    return (
        <>
            <Head title="Fájlkezelő" />

            <PageHeader
                title="Fájlkezelő"
                subtitle="Mappák, tervrajzok, engedélyek, fotók — verziókövetéssel és hozzáférés-kezeléssel."
            />

            {/* Rejtett fájl-bemenetek: fájl / galéria / kamera */}
            <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                    onFilesPicked(e.target.files);
                    e.target.value = '';
                }}
            />
            <input
                ref={galleryInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    onFilesPicked(e.target.files);
                    e.target.value = '';
                }}
            />
            <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                    onFilesPicked(e.target.files);
                    e.target.value = '';
                }}
            />

            <div className="o-card">
                {/* Eszköztár */}
                <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
                    <button
                        className={toolbarBtn}
                        disabled={!can.create || searchMode}
                        onClick={() => setNewFolderOpen(true)}
                    >
                        <FolderPlus size={16} />
                        Új mappa
                    </button>
                    <button
                        className={toolbarBtn}
                        disabled={!can.create || searchMode}
                        onClick={() => fileInput.current?.click()}
                    >
                        <Upload size={16} />
                        Feltöltés
                    </button>
                    <button
                        className={clsx(toolbarBtn, !coarse && 'hidden')}
                        disabled={!can.create || searchMode}
                        onClick={() => galleryInput.current?.click()}
                    >
                        <ImageIcon size={16} />
                        Galéria
                    </button>
                    <button
                        className={clsx(toolbarBtn, !coarse && 'hidden')}
                        disabled={!can.create || searchMode}
                        onClick={() => cameraInput.current?.click()}
                    >
                        <Camera size={16} />
                        Fényképezés
                    </button>

                    {currentFolder && can.manage_permissions && (
                        <button
                            className={toolbarBtn}
                            onClick={() =>
                                setPermsTarget({
                                    id: currentFolder.id,
                                    name: currentFolder.name,
                                    is_restricted: currentFolder.is_restricted,
                                    acl: currentFolder.acl,
                                })
                            }
                        >
                            <Lock size={15} />
                            Jogosultságok
                        </button>
                    )}

                    <div className="ml-auto flex items-center gap-1">
                        <div className="relative">
                            <Search
                                size={14}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
                            />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Keresés…"
                                className="w-40 rounded-md border-line bg-cream/50 py-1.5 pl-8 pr-2 text-sm focus:border-accent focus:bg-white focus:ring-accent/30 sm:w-56"
                            />
                        </div>
                        <div className="flex rounded-md border border-line p-0.5">
                            <button
                                onClick={() => setView('grid')}
                                aria-label="Nagy ikonok"
                                className={clsx(
                                    'rounded p-1.5',
                                    view === 'grid' ? 'bg-accent text-white' : 'text-ink-faint hover:text-ink',
                                )}
                            >
                                <LayoutGrid size={15} />
                            </button>
                            <button
                                onClick={() => setView('details')}
                                aria-label="Részletek"
                                className={clsx(
                                    'rounded p-1.5',
                                    view === 'details' ? 'bg-accent text-white' : 'text-ink-faint hover:text-ink',
                                )}
                            >
                                <Rows3 size={15} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Morzsasor */}
                <div className="flex items-center gap-0.5 overflow-x-auto border-b border-line px-3 py-2 text-sm">
                    {searchMode ? (
                        <span className="flex items-center gap-1.5 text-ink-soft">
                            <Search size={14} />
                            Találatok ({documents.length})
                            <button
                                onClick={() => {
                                    setSearch('');
                                    router.get(route('documents.index'), folderId ? { folder: folderId } : {});
                                }}
                                className="ml-2 text-xs font-medium text-accent hover:text-accent-700"
                            >
                                Vissza a mappákhoz
                            </button>
                        </span>
                    ) : (
                        breadcrumbs.map((crumb, i) => {
                            const last = i === breadcrumbs.length - 1;
                            return (
                                <span key={`${crumb.id}`} className="flex shrink-0 items-center gap-0.5">
                                    {i > 0 && <ChevronRight size={14} className="text-ink-faint" />}
                                    <button
                                        onClick={() => !last && goto(crumb.id)}
                                        {...(!last ? dropProps(crumb.id, crumb.id ?? 'root') : {})}
                                        className={clsx(
                                            'flex items-center gap-1.5 rounded px-1.5 py-0.5',
                                            last
                                                ? 'font-semibold text-sidebar'
                                                : 'text-ink-soft hover:bg-cream hover:text-ink',
                                            dragOverFolder === (crumb.id ?? 'root') &&
                                                !last &&
                                                'bg-accent-50 text-accent-700 ring-1 ring-accent/40',
                                        )}
                                    >
                                        {i === 0 && <HardDrive size={14} />}
                                        {crumb.name}
                                        {last && currentFolder?.is_restricted && (
                                            <Lock size={12} className="text-amberwarn" />
                                        )}
                                    </button>
                                </span>
                            );
                        })
                    )}
                </div>

                {/* Törzs: mappafa + tartalom */}
                <div className="flex">
                    <aside className="hidden w-60 shrink-0 border-r border-line p-2 lg:block">
                        <FolderTree tree={tree} selectedId={folderId} onSelect={goto} />
                    </aside>

                    <div
                        className="min-h-[420px] flex-1 p-3"
                        onContextMenu={(e) => {
                            if (e.target === e.currentTarget) openMenu(null, e);
                        }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setSelected(null);
                        }}
                    >
                        {folders.length === 0 && documents.length === 0 ? (
                            <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
                                <FolderIcon
                                    size={48}
                                    className="text-[#E8B04B]"
                                    fill="#F3CE84"
                                    strokeWidth={1}
                                />
                                <p className="mt-3 text-sm font-medium text-ink-soft">
                                    {searchMode ? 'Nincs találat.' : 'Ez a mappa üres.'}
                                </p>
                                {!searchMode && can.create && (
                                    <p className="mt-1 max-w-xs text-xs text-ink-faint">
                                        Hozzon létre mappát, vagy töltsön fel fájlt az eszköztárból.
                                        Az elemek egérrel is áthúzhatók a mappák között.
                                    </p>
                                )}
                            </div>
                        ) : view === 'grid' ? (
                            /* ---------------- RÁCS NÉZET ---------------- */
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                {folders.map((f) => {
                                    const item: Item = { type: 'folder', row: f };
                                    return (
                                        <div
                                            key={`f-${f.id}`}
                                            draggable={can.edit}
                                            onDragStart={(e) => onItemDragStart(item, e)}
                                            {...dropProps(f.id, f.id)}
                                            onClick={() => itemClick(item)}
                                            onDoubleClick={() => openItem(item)}
                                            onContextMenu={(e) => openMenu(item, e)}
                                            className={clsx(
                                                'group relative flex cursor-default flex-col items-center rounded-md border px-2 py-3 transition',
                                                isSelected(item)
                                                    ? 'border-accent/50 bg-accent-50'
                                                    : 'border-transparent hover:bg-cream',
                                                dragOverFolder === f.id &&
                                                    'border-accent bg-accent-50 ring-1 ring-accent/40',
                                            )}
                                        >
                                            <button
                                                onClick={(e) => openMenu(item, e)}
                                                className={clsx(
                                                    'absolute right-1 top-1 rounded p-1 text-ink-faint hover:bg-white hover:text-ink',
                                                    coarse ? '' : 'opacity-0 group-hover:opacity-100',
                                                )}
                                                aria-label="Műveletek"
                                            >
                                                <MoreVertical size={14} />
                                            </button>
                                            <div className="relative">
                                                <FolderIcon
                                                    size={44}
                                                    className="text-[#E8B04B]"
                                                    fill="#F3CE84"
                                                    strokeWidth={1}
                                                />
                                                {f.is_restricted && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 rounded-sm bg-white p-0.5 shadow-sm">
                                                        <Lock size={11} className="text-amberwarn" />
                                                    </span>
                                                )}
                                            </div>
                                            <span className="mt-1.5 w-full truncate text-center text-xs font-medium text-ink">
                                                {f.name}
                                            </span>
                                            <span className="text-[10px] text-ink-faint">
                                                {f.items_count} elem
                                            </span>
                                        </div>
                                    );
                                })}

                                {documents.map((d) => {
                                    const item: Item = { type: 'file', row: d };
                                    const Icon = fileIcon(d.mime_type, d.original_filename);
                                    return (
                                        <div
                                            key={`d-${d.id}`}
                                            draggable={can.edit}
                                            onDragStart={(e) => onItemDragStart(item, e)}
                                            onClick={() => itemClick(item)}
                                            onDoubleClick={() => openItem(item)}
                                            onContextMenu={(e) => openMenu(item, e)}
                                            className={clsx(
                                                'group relative flex cursor-default flex-col items-center rounded-md border px-2 py-3 transition',
                                                isSelected(item)
                                                    ? 'border-accent/50 bg-accent-50'
                                                    : 'border-transparent hover:bg-cream',
                                            )}
                                        >
                                            <button
                                                onClick={(e) => openMenu(item, e)}
                                                className={clsx(
                                                    'absolute right-1 top-1 z-10 rounded p-1 text-ink-faint hover:bg-white hover:text-ink',
                                                    coarse ? '' : 'opacity-0 group-hover:opacity-100',
                                                )}
                                                aria-label="Műveletek"
                                            >
                                                <MoreVertical size={14} />
                                            </button>
                                            {d.is_image && d.preview_version_id ? (
                                                <img
                                                    src={route('documents.versions.preview', d.preview_version_id)}
                                                    alt=""
                                                    loading="lazy"
                                                    className="h-11 w-14 rounded-sm border border-line object-cover"
                                                />
                                            ) : (
                                                <Icon size={40} className="text-accent" strokeWidth={1.3} />
                                            )}
                                            <span className="mt-1.5 w-full truncate text-center text-xs font-medium text-ink">
                                                {d.title}
                                            </span>
                                            <span className="text-[10px] text-ink-faint">
                                                {fmtBytes(d.size_bytes)}
                                                {d.version_number > 1 && ` · v${d.version_number}`}
                                            </span>
                                            {searchMode && d.location && (
                                                <span className="mt-0.5 w-full truncate text-center text-[10px] text-ink-faint">
                                                    {d.location}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* ---------------- RÉSZLETEK NÉZET ---------------- */
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
                                        <th className="px-2 py-1.5">Név</th>
                                        <th className="hidden px-2 py-1.5 sm:table-cell">Módosítva</th>
                                        <th className="hidden px-2 py-1.5 md:table-cell">Típus</th>
                                        <th className="px-2 py-1.5 text-right">Méret</th>
                                        <th className="w-9" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {folders.map((f) => {
                                        const item: Item = { type: 'folder', row: f };
                                        return (
                                            <tr
                                                key={`f-${f.id}`}
                                                draggable={can.edit}
                                                onDragStart={(e) => onItemDragStart(item, e)}
                                                {...dropProps(f.id, f.id)}
                                                onClick={() => itemClick(item)}
                                                onDoubleClick={() => openItem(item)}
                                                onContextMenu={(e) => openMenu(item, e)}
                                                className={clsx(
                                                    'cursor-default border-b border-line/60 transition',
                                                    isSelected(item) ? 'bg-accent-50' : 'hover:bg-cream/70',
                                                    dragOverFolder === f.id && 'bg-accent-50 ring-1 ring-inset ring-accent/40',
                                                )}
                                            >
                                                <td className="px-2 py-2">
                                                    <span className="flex items-center gap-2">
                                                        <FolderIcon
                                                            size={17}
                                                            className="shrink-0 text-[#E8B04B]"
                                                            fill="#F3CE84"
                                                            strokeWidth={1.3}
                                                        />
                                                        <span className="truncate font-medium text-ink">{f.name}</span>
                                                        {f.is_restricted && (
                                                            <Lock size={12} className="shrink-0 text-amberwarn" />
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="hidden px-2 py-2 text-ink-faint sm:table-cell">
                                                    {fmtDate(f.updated_at)}
                                                </td>
                                                <td className="hidden px-2 py-2 text-ink-faint md:table-cell">Mappa</td>
                                                <td className="px-2 py-2 text-right text-ink-faint">
                                                    {f.items_count} elem
                                                </td>
                                                <td className="px-1 py-2 text-right">
                                                    <button
                                                        onClick={(e) => openMenu(item, e)}
                                                        className="rounded p-1 text-ink-faint hover:bg-white hover:text-ink"
                                                        aria-label="Műveletek"
                                                    >
                                                        <MoreVertical size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {documents.map((d) => {
                                        const item: Item = { type: 'file', row: d };
                                        const Icon = fileIcon(d.mime_type, d.original_filename);
                                        return (
                                            <tr
                                                key={`d-${d.id}`}
                                                draggable={can.edit}
                                                onDragStart={(e) => onItemDragStart(item, e)}
                                                onClick={() => itemClick(item)}
                                                onDoubleClick={() => openItem(item)}
                                                onContextMenu={(e) => openMenu(item, e)}
                                                className={clsx(
                                                    'cursor-default border-b border-line/60 transition',
                                                    isSelected(item) ? 'bg-accent-50' : 'hover:bg-cream/70',
                                                )}
                                            >
                                                <td className="px-2 py-2">
                                                    <span className="flex items-center gap-2">
                                                        <Icon size={17} className="shrink-0 text-accent" strokeWidth={1.4} />
                                                        <span className="min-w-0">
                                                            <span className="block truncate font-medium text-ink">
                                                                {d.title}
                                                                {d.version_number > 1 && (
                                                                    <span className="ml-1 font-mono text-xs text-ink-faint">
                                                                        v{d.version_number}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {searchMode && d.location && (
                                                                <span className="block truncate text-xs text-ink-faint">
                                                                    {d.location}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="hidden px-2 py-2 text-ink-faint sm:table-cell">
                                                    {fmtDate(d.updated_at)}
                                                </td>
                                                <td className="hidden px-2 py-2 text-ink-faint md:table-cell">
                                                    {CATEGORY_LABELS[d.category] ?? d.category}
                                                </td>
                                                <td className="px-2 py-2 text-right text-ink-faint">
                                                    {fmtBytes(d.size_bytes)}
                                                </td>
                                                <td className="px-1 py-2 text-right">
                                                    <button
                                                        onClick={(e) => openMenu(item, e)}
                                                        className="rounded p-1 text-ink-faint hover:bg-white hover:text-ink"
                                                        aria-label="Műveletek"
                                                    >
                                                        <MoreVertical size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Helyi menü */}
            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    items={menuItemsFor(menu.item)}
                    onClose={() => setMenu(null)}
                />
            )}

            {/* Dialógusok */}
            <NameDialog
                open={newFolderOpen}
                title="Új mappa"
                label="A mappa neve"
                submitLabel="Létrehozás"
                error={pageErrors.name}
                busy={busy}
                onSubmit={createFolder}
                onClose={() => setNewFolderOpen(false)}
            />

            <NameDialog
                open={renameTarget !== null}
                title="Átnevezés"
                label={renameTarget?.type === 'folder' ? 'A mappa új neve' : 'A fájl új neve'}
                initial={
                    renameTarget?.type === 'folder'
                        ? (renameTarget.row as ExplorerFolderRow).name
                        : renameTarget
                          ? (renameTarget.row as ExplorerFileRow).title
                          : ''
                }
                submitLabel="Átnevezés"
                error={pageErrors.name ?? pageErrors.title}
                busy={busy}
                onSubmit={renameItem}
                onClose={() => setRenameTarget(null)}
            />

            {moveTarget && (
                <MoveDialog
                    open
                    itemName={
                        moveTarget.type === 'folder'
                            ? (moveTarget.row as ExplorerFolderRow).name
                            : (moveTarget.row as ExplorerFileRow).title
                    }
                    tree={tree}
                    movingFolderId={moveTarget.type === 'folder' ? moveTarget.row.id : null}
                    currentLocation={folderId}
                    busy={busy}
                    onMove={(target) => moveItem(moveTarget, target)}
                    onClose={() => setMoveTarget(null)}
                />
            )}

            {permsTarget && (
                <PermissionsDialog
                    open
                    folder={permsTarget}
                    users={users}
                    onClose={() => setPermsTarget(null)}
                />
            )}

            <UploadDialog
                open={uploadFiles !== null}
                files={uploadFiles ?? []}
                folderId={folderId}
                categories={categories}
                projects={projects}
                onClose={() => setUploadFiles(null)}
            />
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
