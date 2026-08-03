import { useRef, useState } from 'react';
import {
    ArrowUp,
    ArrowUpDown,
    Check,
    ChevronRight,
    ClipboardPaste,
    Copy,
    EllipsisVertical,
    Folder as FolderIcon,
    FolderInput,
    FolderTree as FolderTreeIcon,
    HardDrive,
    LayoutGrid,
    List as ListIcon,
    Lock,
    Pencil,
    Plus,
    Scissors,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import { fmtBytes, fmtDateTime } from '@/lib/format';
import { fileIcon, thumbUrl } from '@/lib/documents';
import {
    type ExplorerItem,
    type ItemKey,
    keyOf,
    kindLabel,
    nameOf,
} from '@/Pages/Documents/Partials/explorer';
import type { ExplorerFileRow, FolderCrumb } from '@/types/models';

/** Mobilon két nézet van: lista és (fotós mappákhoz) rács. */
export type MobileView = 'list' | 'grid';

export interface MobileExplorerProps {
    items: ExplorerItem[];
    breadcrumbs: FolderCrumb[];
    restricted: boolean;
    canUp: boolean;
    parentId: number | null;
    onNavigate: (id: number | null) => void;

    search: string;
    onSearchChange: (value: string) => void;
    searchMode: boolean;
    onClearSearch: () => void;

    view: MobileView;
    onViewChange: (view: MobileView) => void;

    selected: Set<ItemKey>;
    selecting: boolean;
    onToggle: (item: ExplorerItem) => void;
    onBeginSelect: (item: ExplorerItem) => void;
    onEndSelect: () => void;
    onSelectAll: () => void;

    onOpen: (item: ExplorerItem) => void;
    onItemMenu: (item: ExplorerItem) => void;
    onBackgroundMenu: () => void;
    onCreateMenu: () => void;
    onSortMenu: () => void;
    onTree: () => void;

    can: { create: boolean; edit: boolean; delete: boolean };
    clipboardCount: number;
    onCut: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onMove: () => void;
    onRename: () => void;
    onDelete: () => void;

    busy: boolean;
}

/** Hosszú nyomás ideje a kijelölés-mód indításához. */
const LONG_PRESS_MS = 450;

const barBtn =
    'flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-[4px] px-2 text-[13px] text-ink-soft transition active:bg-cream disabled:opacity-35';

/**
 * A fájlkezelő érintésre tervezett felülete.
 *
 * Az asztali Intéző-mása (parancssáv apró ikonokkal, gumikeret, jobbklikk,
 * húzás–ejtés, mappafa oldalt) telefonon használhatatlan volt. Itt minden
 * művelet ujjal elérhető: koppintás = megnyitás, hosszú nyomás = kijelölés-mód
 * alsó műveletsávval, „⋮” = az elem menüje alulról felcsúszó lapon, és egy
 * lebegő gomb a feltöltéshez/fényképezéshez.
 */
export default function MobileExplorer({
    items,
    breadcrumbs,
    restricted,
    canUp,
    parentId,
    onNavigate,
    search,
    onSearchChange,
    searchMode,
    onClearSearch,
    view,
    onViewChange,
    selected,
    selecting,
    onToggle,
    onBeginSelect,
    onEndSelect,
    onSelectAll,
    onOpen,
    onItemMenu,
    onBackgroundMenu,
    onCreateMenu,
    onSortMenu,
    onTree,
    can,
    clipboardCount,
    onCut,
    onCopy,
    onPaste,
    onMove,
    onRename,
    onDelete,
    busy,
}: MobileExplorerProps) {
    const [searchOpen, setSearchOpen] = useState(false);

    /* ---------------- hosszú nyomás ---------------- */
    const press = useRef<{ timer: number; x: number; y: number } | null>(null);
    const swallowClick = useRef(false);

    const cancelPress = () => {
        if (!press.current) return;
        window.clearTimeout(press.current.timer);
        press.current = null;
    };

    const pressProps = (item: ExplorerItem) => ({
        onPointerDown: (e: React.PointerEvent) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            const { clientX: x, clientY: y } = e;
            const timer = window.setTimeout(() => {
                press.current = null;
                swallowClick.current = true;
                navigator.vibrate?.(15);
                onBeginSelect(item);
            }, LONG_PRESS_MS);

            press.current = { timer, x, y };
        },
        onPointerMove: (e: React.PointerEvent) => {
            if (!press.current) return;
            if (
                Math.abs(e.clientX - press.current.x) > 8 ||
                Math.abs(e.clientY - press.current.y) > 8
            ) {
                cancelPress();
            }
        },
        onPointerUp: cancelPress,
        onPointerCancel: cancelPress,
        // Az Android hosszú nyomásra helyi menüt nyitna: a kijelölés-mód a miénk.
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        onClick: () => {
            if (swallowClick.current) {
                swallowClick.current = false;

                return;
            }
            if (selecting) onToggle(item);
            else onOpen(item);
        },
    });

    /* ---------------- bélyegkép ---------------- */
    const thumb = (item: ExplorerItem, size: number) => {
        if (item.type === 'folder') {
            return (
                <span className="relative inline-flex">
                    <FolderIcon
                        size={size}
                        className="text-[#E8B04B]"
                        fill="#F3CE84"
                        strokeWidth={1}
                    />
                    {item.row.is_restricted && (
                        <span className="absolute -bottom-0.5 -right-0.5 rounded-[3px] bg-white p-0.5 shadow-sm">
                            <Lock size={Math.max(9, size / 4)} className="text-amberwarn" />
                        </span>
                    )}
                </span>
            );
        }

        const row = item.row as ExplorerFileRow;

        if (row.is_image && row.has_thumb && row.preview_version_id) {
            return (
                <img
                    src={thumbUrl(row.preview_version_id, size)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full rounded-[3px] border border-line bg-cream object-cover"
                />
            );
        }

        const Icon = fileIcon(row.mime_type, row.original_filename);

        return <Icon size={size} className="text-accent" strokeWidth={1.3} />;
    };

    const metaOf = (item: ExplorerItem) =>
        item.type === 'folder'
            ? `${item.row.items_count} elem`
            : `${fmtBytes(item.row.size_bytes)} · ${fmtDateTime(item.row.updated_at)}`;

    const single = selected.size === 1;

    return (
        <div className="o-card flex flex-col overflow-hidden">
            {/* ---------------- fejléc ---------------- */}
            {selecting ? (
                <div className="flex items-center gap-1 border-b border-line bg-accent-50 px-2 py-2">
                    <button
                        type="button"
                        onClick={onEndSelect}
                        aria-label="Kijelölés vége"
                        className="flex h-10 w-10 items-center justify-center rounded-[4px] text-ink-soft active:bg-white"
                    >
                        <X size={20} />
                    </button>
                    <span className="flex-1 text-sm font-semibold text-accent-700">
                        {selected.size} kijelölve
                    </span>
                    <button type="button" onClick={onSelectAll} className={barBtn}>
                        <Check size={16} />
                        Mind
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-1 border-b border-line px-2 py-2">
                    <button
                        type="button"
                        onClick={onTree}
                        aria-label="Mappák"
                        className="flex h-10 w-10 items-center justify-center rounded-[4px] text-ink-soft active:bg-cream"
                    >
                        <FolderTreeIcon size={19} />
                    </button>

                    {searchOpen || searchMode ? (
                        <div className="relative flex-1">
                            <Search
                                size={15}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
                            />
                            <input
                                type="search"
                                autoFocus={searchOpen}
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder="Keresés a fájlokban"
                                className="h-10 w-full rounded-[4px] border-line bg-cream/50 pl-8 pr-2 text-sm focus:border-accent focus:bg-white focus:ring-accent/30"
                            />
                        </div>
                    ) : (
                        <span className="flex-1 truncate px-1 text-[15px] font-semibold text-sidebar">
                            {breadcrumbs[breadcrumbs.length - 1]?.name ?? 'Fájlok'}
                            {restricted && (
                                <Lock size={13} className="ml-1 inline text-amberwarn" />
                            )}
                        </span>
                    )}

                    <button
                        type="button"
                        aria-label={searchOpen || searchMode ? 'Keresés bezárása' : 'Keresés'}
                        onClick={() => {
                            if (searchMode) onClearSearch();
                            setSearchOpen((prev) => !prev);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-[4px] text-ink-soft active:bg-cream"
                    >
                        {searchOpen || searchMode ? <X size={19} /> : <Search size={19} />}
                    </button>
                    <button
                        type="button"
                        onClick={onBackgroundMenu}
                        aria-label="További műveletek"
                        className="flex h-10 w-10 items-center justify-center rounded-[4px] text-ink-soft active:bg-cream"
                    >
                        <EllipsisVertical size={19} />
                    </button>
                </div>
            )}

            {/* ---------------- morzsa ---------------- */}
            {!searchMode && (
                <div className="flex items-center gap-1 border-b border-line bg-cream/40 px-1.5 py-1">
                    <button
                        type="button"
                        disabled={!canUp}
                        onClick={() => onNavigate(parentId)}
                        aria-label="Egy szinttel feljebb"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-ink-soft active:bg-white disabled:opacity-30"
                    >
                        <ArrowUp size={17} />
                    </button>
                    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto whitespace-nowrap">
                        {breadcrumbs.map((crumb, i) => {
                            const last = i === breadcrumbs.length - 1;

                            return (
                                <span key={crumb.id ?? 'root'} className="flex shrink-0 items-center">
                                    {i > 0 && (
                                        <ChevronRight size={13} className="mx-0.5 text-ink-faint" />
                                    )}
                                    <button
                                        type="button"
                                        disabled={last}
                                        onClick={() => onNavigate(crumb.id)}
                                        className={clsx(
                                            'flex items-center gap-1 rounded-[3px] px-1.5 py-1 text-[13px]',
                                            last
                                                ? 'font-semibold text-sidebar'
                                                : 'text-ink-soft active:bg-white',
                                        )}
                                    >
                                        {i === 0 && <HardDrive size={13} />}
                                        {crumb.name}
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={onSortMenu}
                        aria-label="Rendezés"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-ink-soft active:bg-white"
                    >
                        <ArrowUpDown size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewChange(view === 'list' ? 'grid' : 'list')}
                        aria-label={view === 'list' ? 'Rácsnézet' : 'Listanézet'}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-ink-soft active:bg-white"
                    >
                        {view === 'list' ? <LayoutGrid size={16} /> : <ListIcon size={16} />}
                    </button>
                </div>
            )}

            {/* ---------------- tartalom ---------------- */}
            <div className="relative min-h-[50dvh] select-none [-webkit-touch-callout:none]">
                {items.length === 0 ? (
                    <div className="flex min-h-[50dvh] flex-col items-center justify-center px-6 text-center">
                        <FolderIcon size={48} className="text-[#E8B04B]" fill="#F3CE84" strokeWidth={1} />
                        <p className="mt-3 text-sm font-medium text-ink-soft">
                            {searchMode ? 'Nincs találat.' : 'Ez a mappa üres.'}
                        </p>
                        {!searchMode && can.create && (
                            <p className="mt-1 text-xs text-ink-faint">
                                A jobb alsó <strong>+</strong> gombbal tölthet fel fájlt, fotózhat,
                                vagy hozhat létre mappát.
                            </p>
                        )}
                    </div>
                ) : view === 'grid' ? (
                    /* ---- rács (fotós mappákhoz) ---- */
                    <div className="grid grid-cols-3 gap-1.5 p-1.5 sm:grid-cols-4">
                        {items.map((item) => {
                            const key = keyOf(item);
                            const on = selected.has(key);

                            return (
                                <div
                                    key={key}
                                    {...pressProps(item)}
                                    className={clsx(
                                        'relative overflow-hidden rounded-[4px] border transition',
                                        on ? 'border-accent ring-2 ring-accent/30' : 'border-line',
                                    )}
                                >
                                    <div className="flex aspect-square items-center justify-center bg-cream/60">
                                        {thumb(item, 44)}
                                    </div>
                                    <div className="px-1.5 py-1">
                                        <p className="truncate text-[11px] font-medium text-ink">
                                            {nameOf(item)}
                                        </p>
                                        <p className="truncate text-[10px] text-ink-faint">
                                            {metaOf(item)}
                                        </p>
                                    </div>
                                    {selecting && (
                                        <span
                                            className={clsx(
                                                'absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border',
                                                on
                                                    ? 'border-accent bg-accent text-white'
                                                    : 'border-line bg-white/90',
                                            )}
                                        >
                                            {on && <Check size={13} />}
                                        </span>
                                    )}
                                    {!selecting && (
                                        <button
                                            type="button"
                                            aria-label="Műveletek"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onItemMenu(item);
                                            }}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className="absolute right-0.5 top-0.5 rounded-[3px] bg-white/85 p-1 text-ink-soft"
                                        >
                                            <EllipsisVertical size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ---- lista ---- */
                    <ul className="divide-y divide-line/70">
                        {items.map((item) => {
                            const key = keyOf(item);
                            const on = selected.has(key);

                            return (
                                <li
                                    key={key}
                                    {...pressProps(item)}
                                    className={clsx(
                                        'flex min-h-[58px] items-center gap-3 px-3 py-2 transition',
                                        on ? 'bg-accent-50' : 'active:bg-cream/70',
                                    )}
                                >
                                    {selecting && (
                                        <span
                                            className={clsx(
                                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                                                on
                                                    ? 'border-accent bg-accent text-white'
                                                    : 'border-line bg-white',
                                            )}
                                        >
                                            {on && <Check size={15} />}
                                        </span>
                                    )}

                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                                        {thumb(item, item.type === 'folder' ? 34 : 40)}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[15px] font-medium text-ink">
                                            {nameOf(item)}
                                        </span>
                                        <span className="block truncate text-xs text-ink-faint">
                                            {kindLabel(item)} · {metaOf(item)}
                                        </span>
                                        {searchMode && item.type === 'file' && item.row.location && (
                                            <span className="block truncate text-[11px] text-ink-faint">
                                                {item.row.location}
                                            </span>
                                        )}
                                    </span>

                                    {selecting ? null : item.type === 'folder' ? (
                                        <span className="flex shrink-0 items-center">
                                            <button
                                                type="button"
                                                aria-label="Műveletek"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onItemMenu(item);
                                                }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                className="flex h-10 w-9 items-center justify-center rounded-[4px] text-ink-faint active:bg-cream"
                                            >
                                                <EllipsisVertical size={18} />
                                            </button>
                                            <ChevronRight size={16} className="text-ink-faint" />
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            aria-label="Műveletek"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onItemMenu(item);
                                            }}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] text-ink-faint active:bg-cream"
                                        >
                                            <EllipsisVertical size={18} />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

            </div>

            {/* Lebegő gomb: feltöltés / fénykép / új mappa. Fixen a képernyőhöz
                tapad, hogy hosszú listánál is kéznél legyen. */}
            {!selecting && can.create && !searchMode && (
                <button
                    type="button"
                    onClick={onCreateMenu}
                    aria-label="Új elem"
                    className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_20px_rgba(33,56,46,0.35)] active:bg-accent-600"
                >
                    <Plus size={26} />
                </button>
            )}

            {/* ---------------- állapotsor / kijelölés műveletsáv ---------------- */}
            {selecting ? (
                <div className="grid grid-cols-5 items-center gap-0.5 border-t border-line bg-white px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
                    <button
                        type="button"
                        disabled={!can.edit || selected.size === 0 || busy}
                        onClick={onMove}
                        className="flex flex-col items-center gap-0.5 rounded-[4px] py-1.5 text-[11px] text-ink-soft active:bg-cream disabled:opacity-35"
                    >
                        <FolderInput size={19} />
                        Áthelyezés
                    </button>
                    <button
                        type="button"
                        disabled={selected.size === 0 || busy}
                        onClick={onCopy}
                        className="flex flex-col items-center gap-0.5 rounded-[4px] py-1.5 text-[11px] text-ink-soft active:bg-cream disabled:opacity-35"
                    >
                        <Copy size={19} />
                        Másolás
                    </button>
                    <button
                        type="button"
                        disabled={!can.edit || selected.size === 0 || busy}
                        onClick={onCut}
                        className="flex flex-col items-center gap-0.5 rounded-[4px] py-1.5 text-[11px] text-ink-soft active:bg-cream disabled:opacity-35"
                    >
                        <Scissors size={19} />
                        Kivágás
                    </button>
                    <button
                        type="button"
                        disabled={!can.edit || !single || busy}
                        onClick={onRename}
                        className="flex flex-col items-center gap-0.5 rounded-[4px] py-1.5 text-[11px] text-ink-soft active:bg-cream disabled:opacity-35"
                    >
                        <Pencil size={19} />
                        Átnevezés
                    </button>
                    <button
                        type="button"
                        disabled={!can.delete || selected.size === 0 || busy}
                        onClick={onDelete}
                        className="flex flex-col items-center gap-0.5 rounded-[4px] py-1.5 text-[11px] text-coral active:bg-coral/10 disabled:opacity-35"
                    >
                        <Trash2 size={19} />
                        Törlés
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-2 border-t border-line bg-cream/40 px-3 py-1.5 text-[11px] text-ink-faint">
                    <span className="truncate">
                        {items.length} elem
                        {busy && ' · dolgozom…'}
                    </span>
                    {clipboardCount > 0 && can.create && !searchMode && (
                        <button
                            type="button"
                            onClick={onPaste}
                            className="flex items-center gap-1.5 rounded-[4px] px-2 py-1 font-medium text-accent-700 active:bg-white"
                        >
                            <ClipboardPaste size={14} />
                            Beillesztés ({clipboardCount})
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
