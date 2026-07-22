import { ReactNode, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { MessageSquare, Pin, Send, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDateTime } from '@/lib/format';

interface Announcement {
    id: number;
    title: string;
    body: string;
    is_pinned: boolean;
    author: string | null;
    created_at: string;
    can_delete: boolean;
}

interface IndexProps extends Record<string, unknown> {
    announcements: Announcement[];
    can: { create: boolean };
}

export default function Index() {
    const { announcements, can } = usePageProps<IndexProps>();
    const [composing, setComposing] = useState(false);

    const form = useForm({ title: '', body: '', is_pinned: false });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('communication.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setComposing(false);
            },
        });
    };

    const destroy = (a: Announcement) => {
        if (confirm(`Biztosan törli a(z) „${a.title}” bejegyzést?`)) {
            router.delete(route('communication.destroy', a.id), { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title="Kommunikáció" />

            <PageHeader
                title="Kommunikáció"
                subtitle="Belső üzenőfal — vezetői kiértesítések és közlemények a csapatnak."
                actions={
                    can.create &&
                    !composing && (
                        <button className="btn-primary" onClick={() => setComposing(true)}>
                            <Send size={16} />
                            Új bejegyzés
                        </button>
                    )
                }
            />

            {composing && can.create && (
                <form onSubmit={submit} className="o-card mb-5 p-5">
                    <div className="space-y-3">
                        <div>
                            <InputLabel value="Cím *" />
                            <TextInput
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                isFocused
                            />
                            <InputError message={form.errors.title} />
                        </div>
                        <div>
                            <InputLabel value="Üzenet *" />
                            <textarea
                                value={form.data.body}
                                onChange={(e) => form.setData('body', e.target.value)}
                                rows={4}
                                className="block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                            />
                            <InputError message={form.errors.body} />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-ink-soft">
                            <input
                                type="checkbox"
                                checked={form.data.is_pinned}
                                onChange={(e) => form.setData('is_pinned', e.target.checked)}
                                className="rounded border-line text-accent focus:ring-accent/40"
                            />
                            Kiemelés a lista tetejére
                        </label>
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                        <button type="submit" className="btn-primary" disabled={form.processing}>
                            <Send size={15} />
                            Közzététel
                        </button>
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                                form.reset();
                                setComposing(false);
                            }}
                        >
                            Mégse
                        </button>
                        <span className="ml-auto text-xs text-ink-faint">
                            Közzétételkor mindenki értesítést kap.
                        </span>
                    </div>
                </form>
            )}

            {announcements.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <MessageSquare size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs bejegyzés</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {can.create
                            ? 'Tegye közzé az első közleményt a csapatnak.'
                            : 'Itt jelennek meg a vezetői közlemények.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {announcements.map((a) => (
                        <div
                            key={a.id}
                            className={clsx(
                                'o-card p-5',
                                a.is_pinned && 'border-accent/40 bg-accent-50/30',
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        {a.is_pinned && (
                                            <span title="Kiemelt">
                                                <Pin size={14} className="text-accent" />
                                            </span>
                                        )}
                                        <h3 className="text-base font-semibold text-sidebar">
                                            {a.title}
                                        </h3>
                                    </div>
                                    <p className="mt-0.5 text-xs text-ink-faint">
                                        {a.author ?? 'Ismeretlen'} · {fmtDateTime(a.created_at)}
                                    </p>
                                </div>
                                {a.can_delete && (
                                    <button
                                        onClick={() => destroy(a)}
                                        className="shrink-0 rounded-lg p-2 text-ink-faint hover:bg-cream hover:text-coral"
                                        title="Törlés"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
                                {a.body}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
