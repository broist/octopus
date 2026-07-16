import { FormEvent, useEffect, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';

interface NameDialogProps {
    open: boolean;
    title: string;
    label: string;
    initial?: string;
    submitLabel: string;
    error?: string;
    busy?: boolean;
    onSubmit: (name: string) => void;
    onClose: () => void;
}

/**
 * Egyszerű név-bekérő dialógus (új mappa / átnevezés).
 */
export default function NameDialog({
    open,
    title,
    label,
    initial = '',
    submitLabel,
    error,
    busy = false,
    onSubmit,
    onClose,
}: NameDialogProps) {
    const [name, setName] = useState(initial);

    useEffect(() => {
        if (open) setName(initial);
    }, [open, initial]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
    };

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="o-card w-full max-w-sm p-6">
                    <DialogTitle className="text-base font-semibold text-sidebar">
                        {title}
                    </DialogTitle>
                    <form onSubmit={submit} className="mt-4">
                        <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
                        <TextInput
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            isFocused
                            onFocus={(e) => e.target.select()}
                        />
                        <InputError message={error} />
                        <div className="mt-5 flex gap-2">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={busy || !name.trim()}
                            >
                                {submitLabel}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
