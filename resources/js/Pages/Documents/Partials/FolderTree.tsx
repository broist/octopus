import { useMemo } from 'react';
import { Folder as FolderIcon, HardDrive, Lock } from 'lucide-react';
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
 * Mappafa (bal oldali navigáció + áthelyezés-választó). A lapos listából
 * épít fát; kis fáknál mindig kibontva.
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

    const renderLevel = (parentId: number | null, depth: number) => {
        const nodes = childrenOf.get(parentId) ?? [];
        return nodes.map((node) => {
            const disabled = disabledIds.includes(node.id);
            return (
                <div key={node.id}>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(node.id)}
                        className={clsx(
                            'flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition',
                            selectedId === node.id
                                ? 'bg-accent-50 font-medium text-accent-700'
                                : 'text-ink-soft hover:bg-cream hover:text-ink',
                            disabled && 'cursor-not-allowed opacity-40',
                        )}
                        style={{ paddingLeft: `${8 + depth * 16}px` }}
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
                    {renderLevel(node.id, depth + 1)}
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
            {renderLevel(null, 1)}
        </div>
    );
}
