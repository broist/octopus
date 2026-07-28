import { useEffect, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ArrowUpDown,
    Camera,
    ChevronRight,
    ClipboardPaste,
    Copy,
    Ellipsis,
    HardDrive,
    Image as ImageIcon,
    LayoutGrid,
    Lock,
    Pencil,
    Plus,
    RefreshCw,
    Scissors,
    Search,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import type { FolderCrumb, TreeFolder } from '@/types/models';

/* ================================================================== */
/* Címsáv: navigációs gombok + útvonal + keresés                       */
/* ================================================================== */

export interface DropHandlers {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
}

interface AddressBarProps {
    breadcrumbs: FolderCrumb[];
    tree: TreeFolder[];
    restricted: boolean;
    canBack: boolean;
    canForward: boolean;
    canUp: boolean;
    onBack: () => void;
    onForward: () => void;
    onUp: () => void;
    onRefresh: () => void;
    onNavigate: (id: number | null) => void;
    search: string;
    onSearchChange: (value: string) => void;
    searchMode: boolean;
    resultCount: number;
    onClearSearch: () => void;
    dropKey: string | null;
    crumbDropProps: (id: number | null) => DropHandlers;
}

const navBtn =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-ink-soft transition hover:bg-cream hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

export function AddressBar({
    breadcrumbs,
    tree,
    restricted,
    canBack,
    canForward,
    canUp,
    onBack,
    onForward,
    onUp,
    onRefresh,
    onNavigate,
    search,
    onSearchChange,
    searchMode,
    resultCount,
    onClearSearch,
    dropKey,
    crumbDropProps,
}: AddressBarProps) {
    const [editing, setEditing] = useState(false);
    const [path, setPath] = useState('');
    const [error, setError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const pathText = breadcrumbs.map((c) => c.name).join('\\');

    useEffect(() => {
        if (editing) {
            setPath(pathText);
            setError(false);
            window.setTimeout(() => inputRef.current?.select(), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    /** Beírt útvonal feloldása a mappafán (kis-nagybetű független). */
    const resolvePath = (value: string): { ok: boolean; id: number | null } => {
        const parts = value
            .split(/[\\/]+/)
            .map((p) => p.trim())
            .filter(Boolean);

        if (parts.length && parts[0].toLowerCase() === 'fájlok') parts.shift();
        if (parts.length === 0) return { ok: true, id: null };

        let parent: number | null = null;
        for (const part of parts) {
            const match = tree.find(
                (f) => f.parent_id === parent && f.name.toLowerCase() === part.toLowerCase(),
            );
            if (!match) return { ok: false, id: null };
            parent = match.id;
        }

        return { ok: true, id: parent };
    };

    return (
        <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
            <button className={navBtn} disabled={!canBack} onClick={onBack} title="Vissza (Alt+←)">
                <ArrowLeft size={16} />
            </button>
            <button
                className={navBtn}
                disabled={!canForward}
                onClick={onForward}
                title="Előre (Alt+→)"
            >
                <ArrowRight size={16} />
            </button>
            <button
                className={navBtn}
                disabled={!canUp}
                onClick={onUp}
                title="Egy szinttel feljebb (Alt+↑)"
            >
                <ArrowUp size={16} />
            </button>
            <button className={navBtn} onClick={onRefresh} title="Frissítés (F5)">
                <RefreshCw size={15} />
            </button>

            {/* Útvonal */}
            <div
                className={clsx(
                    'mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-[4px] border bg-cream/40 px-1.5 py-1',
                    error ? 'border-coral' : 'border-line',
                )}
                onDoubleClick={() => !searchMode && setEditing(true)}
            >
                {editing ? (
                    <input
                        ref={inputRef}
                        value={path}
                        onChange={(e) => {
                            setPath(e.target.value);
                            setError(false);
                        }}
                        onBlur={() => setEditing(false)}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Escape') setEditing(false);
                            if (e.key === 'Enter') {
                                const result = resolvePath(path);
                                if (result.ok) {
                                    setEditing(false);
                                    onNavigate(result.id);
                                } else {
                                    setError(true);
                                }
                            }
                        }}
                        placeholder="Fájlok\Projektek\…"
                        className="w-full border-0 bg-transparent p-0 text-[13px] text-ink focus:ring-0"
                    />
                ) : searchMode ? (
                    <span className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                        <Search size={13} />
                        Keresési találatok ({resultCount})
                    </span>
                ) : (
                    <>
                        {breadcrumbs.map((crumb, i) => {
                            const last = i === breadcrumbs.length - 1;
                            return (
                                <span key={`${crumb.id ?? 'root'}`} className="flex shrink-0 items-center">
                                    {i > 0 && (
                                        <ChevronRight size={13} className="mx-0.5 text-ink-faint" />
                                    )}
                                    <button
                                        onClick={() => !last && onNavigate(crumb.id)}
                                        {...(!last ? crumbDropProps(crumb.id) : {})}
                                        className={clsx(
                                            'flex items-center gap-1.5 rounded-[3px] px-1.5 py-0.5 text-[13px]',
                                            last
                                                ? 'font-semibold text-sidebar'
                                                : 'text-ink-soft hover:bg-white hover:text-ink',
                                            dropKey === `crumb-${crumb.id ?? 'root'}` &&
                                                'bg-accent-50 text-accent-700 ring-1 ring-accent/40',
                                        )}
                                    >
                                        {i === 0 && <HardDrive size={13} />}
                                        {crumb.name}
                                        {last && restricted && (
                                            <Lock size={11} className="text-amberwarn" />
                                        )}
                                    </button>
                                </span>
                            );
                        })}
                        <button
                            className="ml-1 flex-1 cursor-text py-0.5 text-left text-[11px] text-ink-faint/70"
                            onClick={() => setEditing(true)}
                            title="Útvonal beírása"
                        >
                            &nbsp;
                        </button>
                    </>
                )}
            </div>

            {/* Keresés */}
            <div className="relative shrink-0">
                <Search
                    size={13}
                    className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Keresés"
                    className="w-32 rounded-[4px] border-line bg-cream/40 py-1 pl-7 pr-2 text-[13px] focus:border-accent focus:bg-white focus:ring-accent/30 sm:w-52"
                />
            </div>
            {searchMode && (
                <button
                    className={navBtn}
                    onClick={onClearSearch}
                    title="Keresés bezárása – vissza a mappákhoz"
                >
                    <X size={15} />
                </button>
            )}
        </div>
    );
}

/* ================================================================== */
/* Parancssáv                                                          */
/* ================================================================== */

interface CommandBarProps {
    can: { create: boolean; edit: boolean; delete: boolean };
    coarse: boolean;
    searchMode: boolean;
    selectionCount: number;
    clipboardCount: number;
    onNewMenu: (e: React.MouseEvent) => void;
    onUploadMenu: (e: React.MouseEvent) => void;
    onSortMenu: (e: React.MouseEvent) => void;
    onViewMenu: (e: React.MouseEvent) => void;
    onMoreMenu: (e: React.MouseEvent) => void;
    onCut: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onRename: () => void;
    onDelete: () => void;
    onGallery: () => void;
    onCamera: () => void;
}

const cmdBtn =
    'inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1.5 text-[13px] text-ink-soft transition hover:bg-cream hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent';

const iconBtn =
    'flex h-8 w-8 items-center justify-center rounded-[4px] text-ink-soft transition hover:bg-cream hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent';

export function CommandBar({
    can,
    coarse,
    searchMode,
    selectionCount,
    clipboardCount,
    onNewMenu,
    onUploadMenu,
    onSortMenu,
    onViewMenu,
    onMoreMenu,
    onCut,
    onCopy,
    onPaste,
    onRename,
    onDelete,
    onGallery,
    onCamera,
}: CommandBarProps) {
    const sep = <span className="mx-1 h-5 w-px shrink-0 bg-line" />;

    return (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-white px-2 py-1.5">
            <button
                className={clsx(cmdBtn, 'font-medium text-ink')}
                disabled={!can.create || searchMode}
                onClick={onNewMenu}
            >
                <Plus size={16} className="text-accent" />
                Új
                <ChevronRight size={12} className="rotate-90 text-ink-faint" />
            </button>

            <button
                className={cmdBtn}
                disabled={!can.create || searchMode}
                onClick={onUploadMenu}
                title="Fájlok vagy egy teljes mappa feltöltése"
            >
                <Upload size={15} />
                Feltöltés
                <ChevronRight size={12} className="rotate-90 text-ink-faint" />
            </button>

            {sep}

            <button
                className={iconBtn}
                title="Kivágás (Ctrl+X)"
                aria-label="Kivágás"
                disabled={!can.edit || selectionCount === 0}
                onClick={onCut}
            >
                <Scissors size={16} />
            </button>
            <button
                className={iconBtn}
                title="Másolás (Ctrl+C)"
                aria-label="Másolás"
                disabled={selectionCount === 0}
                onClick={onCopy}
            >
                <Copy size={16} />
            </button>
            <button
                className={iconBtn}
                title="Beillesztés (Ctrl+V)"
                aria-label="Beillesztés"
                disabled={!can.create || clipboardCount === 0 || searchMode}
                onClick={onPaste}
            >
                <ClipboardPaste size={16} />
            </button>
            <button
                className={iconBtn}
                title="Átnevezés (F2)"
                aria-label="Átnevezés"
                disabled={!can.edit || selectionCount !== 1}
                onClick={onRename}
            >
                <Pencil size={16} />
            </button>
            <button
                className={clsx(iconBtn, 'hover:text-coral')}
                title="Törlés (Del)"
                aria-label="Törlés"
                disabled={!can.delete || selectionCount === 0}
                onClick={onDelete}
            >
                <Trash2 size={16} />
            </button>

            {sep}

            <button className={cmdBtn} onClick={onSortMenu}>
                <ArrowUpDown size={15} />
                Rendezés
            </button>
            <button className={cmdBtn} onClick={onViewMenu}>
                <LayoutGrid size={15} />
                Nézet
            </button>

            {coarse && (
                <>
                    {sep}
                    <button className={iconBtn} title="Galéria" disabled={!can.create} onClick={onGallery}>
                        <ImageIcon size={16} />
                    </button>
                    <button className={iconBtn} title="Fényképezés" disabled={!can.create} onClick={onCamera}>
                        <Camera size={16} />
                    </button>
                </>
            )}

            <div className="ml-auto flex items-center gap-0.5">
                <button className={iconBtn} title="További műveletek" onClick={onMoreMenu}>
                    <Ellipsis size={16} />
                </button>
            </div>
        </div>
    );
}
