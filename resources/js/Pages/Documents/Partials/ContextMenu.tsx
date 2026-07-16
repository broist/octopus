import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
    label: string;
    icon?: LucideIcon;
    danger?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
}

/**
 * Windows-stílusú helyi menü (jobb klikk / "..." gomb).
 */
export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const close = () => onClose();
        const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('click', close);
        window.addEventListener('contextmenu', close);
        window.addEventListener('keydown', key);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('contextmenu', close);
            window.removeEventListener('keydown', key);
            window.removeEventListener('scroll', close, true);
        };
    }, [onClose]);

    // Ne lógjon ki a képernyőről.
    const menuW = 224;
    const menuH = items.length * 36 + 12;
    const left = Math.min(x, window.innerWidth - menuW - 8);
    const top = Math.min(y, window.innerHeight - menuH - 8);

    return (
        <div
            ref={ref}
            className="fixed z-50 w-56 rounded-lg border border-line bg-white py-1.5 shadow-lg"
            style={{ left, top }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, i) => {
                const Icon = item.icon;
                return (
                    <button
                        key={i}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => {
                            onClose();
                            item.onClick();
                        }}
                        className={clsx(
                            'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition',
                            item.danger
                                ? 'text-coral hover:bg-coral/10'
                                : 'text-ink hover:bg-cream',
                            item.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                        )}
                    >
                        {Icon && <Icon size={15} className="shrink-0" />}
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
