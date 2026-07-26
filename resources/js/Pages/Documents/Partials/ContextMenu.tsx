import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export interface MenuAction {
    label: string;
    icon?: LucideIcon;
    /** Gyorsbillentyű-súgó a menüpont jobb szélén (pl. „Ctrl+C”). */
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    /** Pipa a menüpont előtt (nézet/rendezés választás). */
    checked?: boolean;
    submenu?: MenuEntry[];
    onClick?: () => void;
}

export interface MenuSeparator {
    separator: true;
}

export type MenuEntry = MenuAction | MenuSeparator;

/** A Windows 11 helyi menüjének felső ikonsora (kivágás, másolás, átnevezés…). */
export interface QuickAction {
    label: string;
    icon: LucideIcon;
    disabled?: boolean;
    danger?: boolean;
    onClick: () => void;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: MenuEntry[];
    quick?: QuickAction[];
    width?: number;
    onClose: () => void;
}

const isSeparator = (e: MenuEntry): e is MenuSeparator => 'separator' in e;

const ROW =
    'flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-[7px] text-left text-[13px] transition';

/**
 * Windows 11 stílusú helyi menü: felső gyorsművelet-ikonsor, elválasztók,
 * almenük, gyorsbillentyű-súgó és billentyűzetes navigáció.
 */
export default function ContextMenu({
    x,
    y,
    items,
    quick,
    width = 236,
    onClose,
}: ContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: x, top: y });
    const [active, setActive] = useState<number | null>(null);
    const [openSub, setOpenSub] = useState<number | null>(null);
    const [subPos, setSubPos] = useState<{ left: number; top: number } | null>(null);
    const subTimer = useRef<number | null>(null);

    /* A menü ne lógjon ki a képernyőről (a valódi méret alapján igazítva). */
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setPos({
            left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
            top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
        });
    }, [x, y, items.length]);

    useEffect(() => {
        const close = () => onClose();
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
                return;
            }

            const enabled = items
                .map((entry, i) => ({ entry, i }))
                .filter(({ entry }) => !isSeparator(entry) && !(entry as MenuAction).disabled);

            if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                const order = e.key === 'ArrowDown' ? enabled : [...enabled].reverse();
                const current = order.findIndex(({ i }) => i === active);
                setActive(order[(current + 1) % order.length]?.i ?? null);
                setOpenSub(null);
            } else if (e.key === 'Enter' && active !== null) {
                e.preventDefault();
                const entry = items[active];
                if (!isSeparator(entry)) run(entry);
            }
        };

        window.addEventListener('click', close);
        window.addEventListener('contextmenu', close);
        window.addEventListener('keydown', key, true);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('contextmenu', close);
            window.removeEventListener('keydown', key, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
        };
    });

    const run = (entry: MenuAction) => {
        if (entry.disabled) return;
        if (entry.submenu) return;
        onClose();
        entry.onClick?.();
    };

    const hoverSub = (index: number, entry: MenuAction, target: HTMLElement) => {
        if (subTimer.current) window.clearTimeout(subTimer.current);
        if (!entry.submenu) {
            setOpenSub(null);
            return;
        }
        const row = target.getBoundingClientRect();
        const menu = ref.current?.getBoundingClientRect();
        const subWidth = 232;
        const right = (menu?.right ?? row.right) + 2;
        subTimer.current = window.setTimeout(() => {
            setSubPos({
                left: right + subWidth > window.innerWidth ? (menu?.left ?? row.left) - subWidth - 2 : right,
                top: Math.min(row.top - 6, window.innerHeight - entry.submenu!.length * 34 - 24),
            });
            setOpenSub(index);
        }, 90);
    };

    const renderRow = (entry: MenuEntry, i: number, inSub = false) => {
        if (isSeparator(entry)) {
            return <div key={`s-${i}`} className="my-1 border-t border-line/80" />;
        }

        const Icon = entry.icon;
        const highlighted = !inSub && active === i;

        return (
            <button
                key={`i-${i}`}
                type="button"
                disabled={entry.disabled}
                onMouseEnter={(e) => {
                    if (!inSub) {
                        setActive(i);
                        hoverSub(i, entry, e.currentTarget);
                    }
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    run(entry);
                }}
                className={clsx(
                    ROW,
                    entry.danger ? 'text-coral' : 'text-ink',
                    !entry.disabled && (entry.danger ? 'hover:bg-coral/10' : 'hover:bg-cream'),
                    highlighted && !entry.disabled && (entry.danger ? 'bg-coral/10' : 'bg-cream'),
                    entry.disabled && 'cursor-not-allowed opacity-40',
                )}
            >
                <span className="flex w-4 shrink-0 justify-center">
                    {entry.checked ? (
                        <Check size={14} className="text-accent" />
                    ) : Icon ? (
                        <Icon size={15} />
                    ) : null}
                </span>
                <span className="flex-1 truncate">{entry.label}</span>
                {entry.shortcut && (
                    <span className="shrink-0 text-[11px] text-ink-faint">{entry.shortcut}</span>
                )}
                {entry.submenu && <ChevronRight size={13} className="shrink-0 text-ink-faint" />}
            </button>
        );
    };

    const submenu = openSub !== null ? (items[openSub] as MenuAction).submenu : null;

    return (
        <>
            <div
                ref={ref}
                className="fixed z-[60] rounded-[8px] border border-line bg-white p-1.5 shadow-[0_8px_24px_rgba(33,56,46,0.18)]"
                style={{ left: pos.left, top: pos.top, width }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
            >
                {quick && quick.length > 0 && (
                    <>
                        <div className="flex items-center justify-between gap-1 px-0.5 pb-1.5 pt-0.5">
                            {quick.map((q) => (
                                <button
                                    key={q.label}
                                    type="button"
                                    title={q.label}
                                    aria-label={q.label}
                                    disabled={q.disabled}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (q.disabled) return;
                                        onClose();
                                        q.onClick();
                                    }}
                                    className={clsx(
                                        'flex h-8 flex-1 items-center justify-center rounded-[4px] border border-transparent transition',
                                        q.danger ? 'text-coral' : 'text-ink-soft',
                                        q.disabled
                                            ? 'cursor-not-allowed opacity-35'
                                            : 'hover:border-line hover:bg-cream hover:text-ink',
                                    )}
                                >
                                    <q.icon size={16} />
                                </button>
                            ))}
                        </div>
                        <div className="mb-1 border-t border-line/80" />
                    </>
                )}

                {items.map((entry, i) => renderRow(entry, i))}
            </div>

            {submenu && subPos && (
                <div
                    className="fixed z-[61] rounded-[8px] border border-line bg-white p-1.5 shadow-[0_8px_24px_rgba(33,56,46,0.18)]"
                    style={{ left: subPos.left, top: Math.max(8, subPos.top), width: 232 }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => {
                        if (subTimer.current) window.clearTimeout(subTimer.current);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {submenu.map((entry, i) => renderRow(entry, i, true))}
                </div>
            )}
        </>
    );
}
