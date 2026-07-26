import { ReactNode } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/**
 * Megerősítő párbeszéd (törlés) — a Windows „Biztosan törli?” ablakának mintájára.
 */
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Igen',
    danger = true,
    busy = false,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} className="relative z-[70]">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-sm overflow-hidden rounded-[8px] border border-line bg-white shadow-[0_12px_40px_rgba(33,56,46,0.25)]">
                    <div className="flex gap-3 px-5 py-4">
                        <AlertTriangle
                            size={22}
                            className={clsx('mt-0.5 shrink-0', danger ? 'text-coral' : 'text-amberwarn')}
                        />
                        <div className="min-w-0">
                            <DialogTitle className="text-sm font-semibold text-sidebar">
                                {title}
                            </DialogTitle>
                            <div className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                                {message}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-line bg-cream/40 px-5 py-3">
                        <button
                            className={clsx(
                                'btn !py-1.5 text-[13px] text-white',
                                danger ? 'bg-coral hover:bg-coral/90' : 'bg-accent hover:bg-accent-600',
                            )}
                            disabled={busy}
                            onClick={onConfirm}
                        >
                            {confirmLabel}
                        </button>
                        <button className="btn-ghost !py-1.5 text-[13px]" onClick={onClose}>
                            Mégse
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
