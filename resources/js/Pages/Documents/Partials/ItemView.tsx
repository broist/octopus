import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, EllipsisVertical, Folder as FolderIcon, Lock } from 'lucide-react';
import clsx from 'clsx';
import { fmtBytes, fmtDateTime } from '@/lib/format';
import { fileIcon, thumbUrl } from '@/lib/documents';
import {
    ICON_SIZE,
    type ExplorerItem,
    type ItemKey,
    type SortKey,
    type SortState,
    type ViewMode,
    baseName,
    keyOf,
    kindLabel,
    nameOf,
} from '@/Pages/Documents/Partials/explorer';

export interface ItemHandlers {
    onMouseDown: (item: ExplorerItem, e: React.MouseEvent) => void;
    onClick: (item: ExplorerItem, e: React.MouseEvent) => void;
    onDoubleClick: (item: ExplorerItem) => void;
    onContextMenu: (item: ExplorerItem, e: React.MouseEvent) => void;
    onDragStart: (item: ExplorerItem, e: React.DragEvent) => void;
    onDragEnd: () => void;
    /** Mappára ejtés (belső elem vagy gépről behúzott fájl). */
    onFolderDragOver: (item: ExplorerItem, e: React.DragEvent) => void;
    onFolderDragLeave: () => void;
    onFolderDrop: (item: ExplorerItem, e: React.DragEvent) => void;
    onRenameCommit: (item: ExplorerItem, name: string) => void;
    onRenameCancel: () => void;
}

interface ItemViewProps {
    items: ExplorerItem[];
    view: ViewMode;
    sort: SortState;
    onSort: (key: SortKey) => void;
    selected: Set<ItemKey>;
    cutKeys: Set<ItemKey>;
    renaming: ItemKey | null;
    dropTarget: ItemKey | null;
    searchMode: boolean;
    canDrag: boolean;
    /** Érintőképernyőn a jobb klikk helyett „⋮” gomb nyitja a helyi menüt. */
    showMenuButton?: boolean;
    handlers: ItemHandlers;
}

/** Helyben szerkeszthető név (F2 / „Átnevezés”), Intéző-módra: Enter ment, Esc elvet. */
function RenameInput({
    initial,
    isFolder,
    onCommit,
    onCancel,
    className,
}: {
    initial: string;
    isFolder: boolean;
    onCommit: (value: string) => void;
    onCancel: () => void;
    className?: string;
}) {
    const ref = useRef<HTMLInputElement>(null);
    const done = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        // A Windows a kiterjesztés nélküli részt jelöli ki.
        const stem = isFolder ? initial : baseName(initial);
        el.setSelectionRange(0, stem.length);
    }, [initial, isFolder]);

    const commit = () => {
        if (done.current) return;
        done.current = true;
        const value = ref.current?.value.trim() ?? '';
        if (value && value !== initial) onCommit(value);
        else onCancel();
    };

    return (
        <input
            ref={ref}
            defaultValue={initial}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                    done.current = true;
                    onCancel();
                }
            }}
            className={clsx(
                'w-full rounded-[3px] border border-accent bg-white px-1 py-0.5 text-xs text-ink outline-none ring-2 ring-accent/25',
                className,
            )}
        />
    );
}

export default function ItemView({
    items,
    view,
    sort,
    onSort,
    selected,
    cutKeys,
    renaming,
    dropTarget,
    searchMode,
    canDrag,
    showMenuButton = false,
    handlers,
}: ItemViewProps) {
    const iconSize = ICON_SIZE[view];

    const menuButton = (item: ExplorerItem, className: string) =>
        showMenuButton ? (
            <button
                type="button"
                aria-label="Műveletek"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    handlers.onContextMenu(item, e);
                }}
                className={clsx(
                    'rounded-[3px] p-1 text-ink-faint hover:bg-white hover:text-ink',
                    className,
                )}
            >
                <EllipsisVertical size={15} />
            </button>
        ) : null;

    /** Minden nézetben azonos kijelölés-/húzás-viselkedés. */
    const rowProps = (item: ExplorerItem) => {
        const key = keyOf(item);
        const isFolder = item.type === 'folder';

        return {
            'data-key': key,
            draggable: canDrag && renaming !== key,
            onMouseDown: (e: React.MouseEvent) => handlers.onMouseDown(item, e),
            onClick: (e: React.MouseEvent) => handlers.onClick(item, e),
            onDoubleClick: () => handlers.onDoubleClick(item),
            onContextMenu: (e: React.MouseEvent) => handlers.onContextMenu(item, e),
            onDragStart: (e: React.DragEvent) => handlers.onDragStart(item, e),
            onDragEnd: handlers.onDragEnd,
            ...(isFolder
                ? {
                      onDragOver: (e: React.DragEvent) => handlers.onFolderDragOver(item, e),
                      onDragLeave: handlers.onFolderDragLeave,
                      onDrop: (e: React.DragEvent) => handlers.onFolderDrop(item, e),
                  }
                : {}),
        };
    };

    const stateClass = (item: ExplorerItem) => {
        const key = keyOf(item);
        return clsx(
            selected.has(key)
                ? 'border-accent/45 bg-accent-50'
                : 'border-transparent hover:border-line hover:bg-cream/70',
            dropTarget === key && 'border-accent bg-accent-50 ring-2 ring-accent/30',
            cutKeys.has(key) && 'opacity-45',
        );
    };

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

        const row = item.row;
        // Bélyegkép, sosem az eredeti: egy telefonfotó több megabájt, a
        // bélyegképe néhány tíz kilobájt.
        if (row.is_image && row.has_thumb && row.preview_version_id) {
            return (
                <img
                    src={thumbUrl(row.preview_version_id, Math.round(size * 1.25))}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={Math.round(size * 1.25)}
                    height={size}
                    className="rounded-[3px] border border-line bg-cream object-cover"
                    style={{ width: size * 1.25, height: size }}
                />
            );
        }

        const Icon = fileIcon(row.mime_type, row.original_filename);
        return <Icon size={size} className="text-accent" strokeWidth={1.3} />;
    };

    const metaOf = (item: ExplorerItem) =>
        item.type === 'folder'
            ? `${item.row.items_count} elem`
            : `${fmtBytes(item.row.size_bytes)}${item.row.version_number > 1 ? ` · v${item.row.version_number}` : ''}`;

    /* ---------------- RÁCS (nagyon nagy / nagy / közepes ikonok) ---------------- */
    if (view === 'xl' || view === 'large' || view === 'medium') {
        const min = view === 'xl' ? 190 : view === 'large' ? 140 : 112;

        return (
            <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}
            >
                {items.map((item) => {
                    const key = keyOf(item);
                    return (
                        <div
                            key={key}
                            {...rowProps(item)}
                            className={clsx(
                                'relative flex cursor-default select-none flex-col items-center rounded-[4px] border px-1.5 py-2.5 transition',
                                stateClass(item),
                            )}
                        >
                            {menuButton(item, 'absolute right-0.5 top-0.5 z-10')}
                            {thumb(item, iconSize)}
                            <div className="mt-1.5 w-full px-0.5">
                                {renaming === key ? (
                                    <RenameInput
                                        initial={nameOf(item)}
                                        isFolder={item.type === 'folder'}
                                        onCommit={(value) => handlers.onRenameCommit(item, value)}
                                        onCancel={handlers.onRenameCancel}
                                        className="text-center"
                                    />
                                ) : (
                                    <span
                                        className="block break-words text-center text-xs font-medium leading-tight text-ink"
                                        style={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                        title={nameOf(item)}
                                    >
                                        {nameOf(item)}
                                    </span>
                                )}
                            </div>
                            <span className="mt-0.5 text-[10px] text-ink-faint">{metaOf(item)}</span>
                            {searchMode && item.type === 'file' && item.row.location && (
                                <span className="w-full truncate text-center text-[10px] text-ink-faint">
                                    {item.row.location}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    /* ---------------- CSEMPÉK ---------------- */
    if (view === 'tiles') {
        return (
            <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}
            >
                {items.map((item) => {
                    const key = keyOf(item);
                    return (
                        <div
                            key={key}
                            {...rowProps(item)}
                            className={clsx(
                                'flex cursor-default select-none items-center gap-2.5 rounded-[4px] border px-2 py-2 transition',
                                stateClass(item),
                            )}
                        >
                            <span className="shrink-0">{thumb(item, iconSize)}</span>
                            <span className="min-w-0 flex-1">
                                {renaming === key ? (
                                    <RenameInput
                                        initial={nameOf(item)}
                                        isFolder={item.type === 'folder'}
                                        onCommit={(value) => handlers.onRenameCommit(item, value)}
                                        onCancel={handlers.onRenameCancel}
                                    />
                                ) : (
                                    <span className="block truncate text-[13px] font-medium text-ink">
                                        {nameOf(item)}
                                    </span>
                                )}
                                <span className="block truncate text-[11px] text-ink-faint">
                                    {kindLabel(item)} · {metaOf(item)}
                                </span>
                            </span>
                            {menuButton(item, 'shrink-0')}
                        </div>
                    );
                })}
            </div>
        );
    }

    /* ---------------- LISTA (oszlopokba tördelve, mint az Intézőben) ---------------- */
    if (view === 'list') {
        return (
            <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
                {items.map((item) => {
                    const key = keyOf(item);
                    return (
                        <div
                            key={key}
                            {...rowProps(item)}
                            className={clsx(
                                'mb-0.5 flex cursor-default select-none items-center gap-2 break-inside-avoid rounded-[4px] border px-2 py-1 transition',
                                stateClass(item),
                            )}
                        >
                            <span className="shrink-0">{thumb(item, iconSize)}</span>
                            {renaming === key ? (
                                <RenameInput
                                    initial={nameOf(item)}
                                    isFolder={item.type === 'folder'}
                                    onCommit={(value) => handlers.onRenameCommit(item, value)}
                                    onCancel={handlers.onRenameCancel}
                                />
                            ) : (
                                <span className="truncate text-[13px] text-ink" title={nameOf(item)}>
                                    {nameOf(item)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    /* ---------------- RÉSZLETEK ---------------- */
    const header = (key: SortKey, label: string, className?: string) => (
        <th className={clsx('px-2 py-1.5 font-medium', className)}>
            <button
                type="button"
                onClick={() => onSort(key)}
                className="flex items-center gap-1 text-left uppercase tracking-wide text-ink-faint hover:text-ink"
            >
                {label}
                {sort.key === key &&
                    (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </button>
        </th>
    );

    return (
        <table className="w-full table-fixed text-sm">
            <thead>
                <tr className="border-b border-line text-left text-[11px]">
                    {header('name', 'Név')}
                    {header('updated', 'Módosítva', 'hidden w-40 sm:table-cell')}
                    {header('type', 'Típus', 'hidden w-44 md:table-cell')}
                    {header('size', 'Méret', 'w-24')}
                    {showMenuButton && <th className="w-9" />}
                </tr>
            </thead>
            <tbody>
                {items.map((item) => {
                    const key = keyOf(item);
                    return (
                        <tr
                            key={key}
                            {...rowProps(item)}
                            className={clsx(
                                'cursor-default select-none border-b border-line/50 transition',
                                selected.has(key) ? 'bg-accent-50' : 'hover:bg-cream/70',
                                dropTarget === key && 'bg-accent-50 ring-1 ring-inset ring-accent/40',
                                cutKeys.has(key) && 'opacity-45',
                            )}
                        >
                            <td className="px-2 py-1.5">
                                <span className="flex items-center gap-2">
                                    <span className="shrink-0">{thumb(item, 17)}</span>
                                    <span className="min-w-0 flex-1">
                                        {renaming === key ? (
                                            <RenameInput
                                                initial={nameOf(item)}
                                                isFolder={item.type === 'folder'}
                                                onCommit={(value) =>
                                                    handlers.onRenameCommit(item, value)
                                                }
                                                onCancel={handlers.onRenameCancel}
                                            />
                                        ) : (
                                            <span
                                                className="block truncate text-[13px] font-medium text-ink"
                                                title={nameOf(item)}
                                            >
                                                {nameOf(item)}
                                                {item.type === 'file' &&
                                                    item.row.version_number > 1 && (
                                                        <span className="ml-1 font-mono text-[11px] text-ink-faint">
                                                            v{item.row.version_number}
                                                        </span>
                                                    )}
                                            </span>
                                        )}
                                        {searchMode && item.type === 'file' && item.row.location && (
                                            <span className="block truncate text-[11px] text-ink-faint">
                                                {item.row.location}
                                            </span>
                                        )}
                                    </span>
                                </span>
                            </td>
                            <td className="hidden px-2 py-1.5 text-[12px] text-ink-faint sm:table-cell">
                                {fmtDateTime(item.row.updated_at)}
                            </td>
                            <td className="hidden truncate px-2 py-1.5 text-[12px] text-ink-faint md:table-cell">
                                {kindLabel(item)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[12px] text-ink-faint">
                                {item.type === 'folder'
                                    ? `${item.row.items_count} elem`
                                    : fmtBytes(item.row.size_bytes)}
                            </td>
                            {showMenuButton && (
                                <td className="px-1 py-1.5 text-right">
                                    {menuButton(item, '')}
                                </td>
                            )}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
