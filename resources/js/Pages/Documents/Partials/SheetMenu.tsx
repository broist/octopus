import { useEffect, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { MenuAction, MenuEntry, QuickAction } from '@/Pages/Documents/Partials/ContextMenu';

interface SheetMenuProps {
    open: boolean;
    title?: string;
    items: MenuEntry[];
    quick?: QuickAction[];
    onClose: () => void;
}

const isSeparator = (e: MenuEntry): e is { separator: true } => 'separator' in e;

/**
 * Ugyanaz a menü, mint az asztali helyi menü — csak érintésre.
 *
 * Telefonon a kurzorhoz igazított, 13 képpontos sorokból álló legördülő
 * használhatatlan: itt alulról felcsúszó lap jelenik meg, ujjnyi (48 képpontos)
 * sorokkal, az almenükbe pedig belépünk (nem oldalra nyílnak).
 */
export default function SheetMenu({ open, title, items, quick, onClose }: SheetMenuProps) {
    const [drill, setDrill] = useState<MenuAction | null>(null);

    // Új menü nyitásakor mindig a legfelső szintről indulunk.
    useEffect(() => {
        if (open) setDrill(null);
    }, [open, items]);

    const shown = drill?.submenu ?? items;

    const run = (entry: MenuAction) => {
        if (entry.disabled) return;

        if (entry.submenu) {
            setDrill(entry);

            return;
        }

        onClose();
        entry.onClick?.();
    };

    return (
        <Dialog open={open} onClose={onClose} className="relative z-[60]">
            <DialogBackdrop className="fixed inset-0 bg-black/40" />
            <div className="fixed inset-0 flex items-end justify-center">
                <DialogPanel className="max-h-[80dvh] w-full overflow-y-auto rounded-t-xl border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(33,56,46,0.18)]">
                    {/* Fogantyú */}
                    <div className="sticky top-0 z-10 bg-white pt-2">
                        <div className="mx-auto h-1 w-10 rounded-full bg-line" />

                        {(drill || title) && (
                            <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
                                {drill && (
                                    <button
                                        type="button"
                                        onClick={() => setDrill(null)}
                                        aria-label="Vissza"
                                        className="flex h-9 w-9 items-center justify-center rounded-[4px] text-ink-soft hover:bg-cream"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                )}
                                <span className="truncate text-sm font-semibold text-sidebar">
                                    {drill ? drill.label : title}
                                </span>
                            </div>
                        )}
                        <div className="border-b border-line" />
                    </div>

                    {/* Gyorsműveletek ikonsora */}
                    {!drill && quick && quick.length > 0 && (
                        <div className="flex items-center gap-1 border-b border-line px-2 py-2">
                            {quick.map((q) => (
                                <button
                                    key={q.label}
                                    type="button"
                                    disabled={q.disabled}
                                    onClick={() => {
                                        if (q.disabled) return;
                                        onClose();
                                        q.onClick();
                                    }}
                                    className={clsx(
                                        'flex flex-1 flex-col items-center gap-1 rounded-[4px] px-1 py-2 text-[11px]',
                                        q.danger ? 'text-coral' : 'text-ink-soft',
                                        q.disabled ? 'opacity-35' : 'active:bg-cream',
                                    )}
                                >
                                    <q.icon size={20} />
                                    <span className="truncate">{q.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="p-1.5">
                        {shown.map((entry, i) =>
                            isSeparator(entry) ? (
                                <div key={`s-${i}`} className="my-1 border-t border-line/80" />
                            ) : (
                                <button
                                    key={`i-${i}`}
                                    type="button"
                                    disabled={entry.disabled}
                                    onClick={() => run(entry)}
                                    className={clsx(
                                        'flex min-h-[48px] w-full items-center gap-3 rounded-[4px] px-3 text-left text-[15px]',
                                        entry.danger ? 'text-coral' : 'text-ink',
                                        entry.disabled ? 'opacity-35' : 'active:bg-cream',
                                    )}
                                >
                                    <span className="flex w-5 shrink-0 justify-center">
                                        {entry.checked ? (
                                            <Check size={18} className="text-accent" />
                                        ) : entry.icon ? (
                                            <entry.icon size={18} />
                                        ) : null}
                                    </span>
                                    <span className="flex-1 truncate">{entry.label}</span>
                                    {entry.submenu && (
                                        <ChevronRight size={16} className="shrink-0 text-ink-faint" />
                                    )}
                                </button>
                            ),
                        )}
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
