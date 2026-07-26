import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Folder as FolderIcon, HardDrive, Lock } from 'lucide-react';
import clsx from 'clsx';
import type { TreeFolder } from '@/types/models';

interface FolderTreeProps {
    tree: TreeFolder[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    /** Ezek nem választhatók (pl. mozgatásnál önmaga + almappái). */
    disabledIds?: number[];
    rootLabel?: string;
}

/**
 * Mappafa (bal oldali navigáció + áthelyezés-választó).
 *
 * Nagy struktúráknál (több száz mappa) a teljesen kibontott fa használhatatlan,
 * ezért az ágak alapból ZÁRVA vannak: csak a felső szint látszik, és a nyíllal
 * lehet lenyitni. A kiválasztott mappához vezető út automatikusan kinyílik.
 */
export default function FolderTree({
    tree,
    selectedId,
    onSelect,
    disabledIds = [],
    rootLabel = 'Fájlok',
}: FolderTreeProps) {
    const childrenOf = useMemo(() => {
        const map = new Map<number | null, TreeFolder[]>();
        for (const f of tree) {
            const key = f.parent_id;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(f);
        }
        return map;
    }, [tree]);

    const parentOf = useMemo(() => {
        const map = new Map<number, number | null>();
        for (const f of tree) map.set(f.id, f.parent_id);
        return map;
    }, [tree]);

    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    // A kiválasztott mappa őseit mindig nyitva tartjuk, hogy látszódjon, hol vagyunk.
    useEffect(() => {
        if (selectedId === null) return;
        setExpanded((prev) => {
            const next = new Set(prev);
            let current = parentOf.get(selectedId) ?? null;
            while (current !== null) {
                next.add(current);
                current = parentOf.get(current) ?? null;
            }
            return next;
        });
    }, [selectedId, parentOf]);

    const toggle = (id: number) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const renderLevel = (parentId: number | null, depth: number) => {
        const nodes = childrenOf.get(parentId) ?? [];
        return nodes.map((node) => {
            const disabled = disabledIds.includes(node.id);
            const hasChildren = (childrenOf.get(node.id) ?? []).length > 0;
            const isOpen = expanded.has(node.id);

            return (
                <div key={node.id}>
                    <div
                        className={clsx(
                            'flex items-center rounded-md transition',
                            selectedId === node.id
                                ? 'bg-accent-50 text-accent-700'
                                : 'text-ink-soft hover:bg-cream hover:text-ink',
                        )}
                        style={{ paddingLeft: `${depth * 12}px` }}
                    >
                        {hasChildren ? (
                            <button
                                type="button"
                                aria-label={isOpen ? 'Bezárás' : 'Kinyitás'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggle(node.id);
                                }}
                                className="shrink-0 rounded p-0.5 text-ink-faint hover:text-ink"
                            >
                                <ChevronRight
                                    size={13}
                                    className={clsx('transition-transform', isOpen && 'rotate-90')}
                                />
                            </button>
                        ) : (
                            <span className="w-[18px] shrink-0" />
                        )}
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelect(node.id)}
                            className={clsx(
                                'flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-sm',
                                selectedId === node.id && 'font-medium',
                                disabled && 'cursor-not-allowed opacity-40',
                            )}
                        >
                            <FolderIcon
                                size={15}
                                className="shrink-0 text-[#E8B04B]"
                                fill="#F3CE84"
                                strokeWidth={1.5}
                            />
                            <span className="truncate">{node.name}</span>
                            {node.is_restricted && (
                                <Lock size={11} className="ml-auto shrink-0 text-ink-faint" />
                            )}
                        </button>
                    </div>
                    {isOpen && renderLevel(node.id, depth + 1)}
                </div>
            );
        });
    };

    return (
        <div className="space-y-0.5">
            <button
                type="button"
                onClick={() => onSelect(null)}
                className={clsx(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                    selectedId === null
                        ? 'bg-accent-50 font-medium text-accent-700'
                        : 'text-ink-soft hover:bg-cream hover:text-ink',
                )}
            >
                <HardDrive size={15} className="shrink-0 text-ink-faint" />
                <span>{rootLabel}</span>
            </button>
            {renderLevel(null, 0)}
        </div>
    );
}
