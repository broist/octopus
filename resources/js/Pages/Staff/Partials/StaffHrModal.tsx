import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { StaffDetail } from '@/types/models';

interface HrFormData {
    phone: string;
    job_title: string;
    hired_on: string;
    [key: string]: string;
}

export default function StaffHrModal({ staff, onClose }: { staff: StaffDetail; onClose: () => void }) {
    const form = useForm<HrFormData>({
        phone: staff.phone ?? '',
        job_title: staff.job_title ?? '',
        hired_on: staff.hired_on ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(route('staff.hr.update', staff.id), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card w-full max-w-md p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        HR-adatok szerkesztése
                    </DialogTitle>
                    <p className="mt-1 text-xs text-ink-faint">
                        A név, e-mail, szerepkör és aktiválás a Felhasználók modulban módosítható.
                    </p>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div>
                            <InputLabel value="Beosztás / munkakör" />
                            <TextInput
                                value={form.data.job_title}
                                onChange={(e) => form.setData('job_title', e.target.value)}
                                placeholder="pl. Csoportvezető, villanyszerelő…"
                                isFocused
                                autoComplete="off"
                            />
                            <InputError message={form.errors.job_title} />
                        </div>
                        <div>
                            <InputLabel value="Telefonszám" />
                            <TextInput
                                value={form.data.phone}
                                onChange={(e) => form.setData('phone', e.target.value)}
                                placeholder="+36 …"
                                autoComplete="off"
                            />
                            <InputError message={form.errors.phone} />
                        </div>
                        <div>
                            <InputLabel value="Belépés dátuma" />
                            <TextInput
                                type="date"
                                value={form.data.hired_on}
                                onChange={(e) => form.setData('hired_on', e.target.value)}
                            />
                            <InputError message={form.errors.hired_on} />
                        </div>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                Mentés
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
