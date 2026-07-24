import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { ChecklistTemplateRow } from '@/types/models';

interface TemplateFormData {
    name: string;
    purpose: string;
    description: string;
    is_active: boolean;
    items: string[];
    [key: string]: string | boolean | string[];
}

const selectClass = 'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

export default function TemplateModal({
    template,
    purposes,
    onClose,
}: {
    template: ChecklistTemplateRow | null;
    purposes: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm<TemplateFormData>({
        name: template?.name ?? '',
        purpose: template?.purpose ?? 'minoseg',
        description: template?.description ?? '',
        is_active: template?.is_active ?? true,
        items: template?.items.map((i) => i.text) ?? [''],
    });

    const setItem = (i: number, val: string) =>
        form.setData('items', form.data.items.map((t, idx) => (idx === i ? val : t)));
    const addItem = () => form.setData('items', [...form.data.items, '']);
    const removeItem = (i: number) => form.setData('items', form.data.items.filter((_, idx) => idx !== i));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({
            ...d,
            is_active: d.is_active ? 1 : 0,
            items: (d.items as string[]).map((t) => t.trim()).filter((t) => t !== ''),
            ...(template ? { _method: 'put' } : {}),
        }));
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (template) {
            form.post(route('qa.templates.update', template.id), opts);
        } else {
            form.post(route('qa.templates.store'), opts);
        }
    };

    return (
        <Dialog open onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="o-card my-8 w-full max-w-lg p-6">
                    <DialogTitle className="text-lg font-semibold text-sidebar">
                        {template ? 'Sablon szerkesztése' : 'Új ellenőrző-sablon'}
                    </DialogTitle>

                    <form onSubmit={submit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel value="Név *" />
                                <TextInput value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} isFocused autoComplete="off" placeholder="pl. Átadás-átvételi ellenőrzés" />
                                <InputError message={form.errors.name} />
                            </div>
                            <div>
                                <InputLabel value="Cél *" />
                                <select value={form.data.purpose} onChange={(e) => form.setData('purpose', e.target.value)} className={selectClass}>
                                    {Object.entries(purposes).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Leírás" />
                            <textarea value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} rows={2} className={selectClass} />
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <InputLabel value="Ellenőrzési pontok" />
                                <button type="button" onClick={addItem} className="btn-ghost !py-1 text-xs text-accent">
                                    <Plus size={14} />
                                    Pont
                                </button>
                            </div>
                            <div className="space-y-2">
                                {form.data.items.map((text, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <GripVertical size={14} className="shrink-0 text-ink-faint" />
                                        <input
                                            type="text"
                                            value={text}
                                            onChange={(e) => setItem(i, e.target.value)}
                                            placeholder={`${i + 1}. ellenőrzési pont`}
                                            className={selectClass}
                                        />
                                        <button type="button" onClick={() => removeItem(i)} className="btn-ghost !p-2 text-coral hover:bg-coral/10">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {form.data.items.length === 0 && (
                                    <p className="text-xs text-ink-faint">Adjon hozzá legalább egy ellenőrzési pontot.</p>
                                )}
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-ink">
                            <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} className="rounded-sm border-line text-accent focus:ring-accent/40" />
                            Aktív (választható új ellenőrzésnél)
                        </label>

                        <div className="flex items-center gap-2 border-t border-line pt-4">
                            <button type="submit" className="btn-primary" disabled={form.processing}>
                                {template ? 'Mentés' : 'Sablon létrehozása'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>Mégse</button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
