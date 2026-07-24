import { ReactNode, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import QaNav from '@/Pages/Qa/Partials/QaNav';
import TemplateModal from '@/Pages/Qa/Partials/TemplateModal';
import { usePageProps } from '@/hooks/usePageProps';
import type { ChecklistTemplateRow } from '@/types/models';

interface TemplatesProps extends Record<string, unknown> {
    templates: ChecklistTemplateRow[];
    purposes: Record<string, string>;
    canManage: boolean;
    canDelete: boolean;
}

export default function Templates() {
    const { templates, purposes, canManage, canDelete } = usePageProps<TemplatesProps>();
    const [modal, setModal] = useState<{ template: ChecklistTemplateRow | null } | null>(null);

    return (
        <>
            <Head title="Ellenőrző-sablonok" />

            <PageHeader
                title="Minőség / Munkavédelem"
                subtitle="Szerkeszthető ellenőrző-sablonok — hozzon létre saját checklistet átadáshoz, munkavédelemhez, minőségi ellenőrzéshez."
                actions={
                    canManage && (
                        <button className="btn-primary" onClick={() => setModal({ template: null })}>
                            <Plus size={16} />
                            Új sablon
                        </button>
                    )
                }
            />

            <QaNav active="templates" />

            {templates.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <ListChecks size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Még nincs ellenőrző-sablon</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        Hozzon létre egy testre szabható checklistet — a pontokat bármikor módosíthatja.
                    </p>
                    {canManage && (
                        <button className="btn-primary mt-5" onClick={() => setModal({ template: null })}>
                            <Plus size={16} />
                            Új sablon
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {templates.map((t) => (
                        <div key={t.id} className={clsx('o-card p-5', !t.is_active && 'opacity-60')}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm font-semibold text-sidebar">{t.name}</h3>
                                        <span className="chip chip-grey">{t.purpose_label}</span>
                                        {!t.is_active && <span className="chip chip-grey">inaktív</span>}
                                    </div>
                                    {t.description && <p className="mt-1 text-xs text-ink-soft">{t.description}</p>}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    {canManage && (
                                        <button onClick={() => setModal({ template: t })} className="btn-ghost !p-2" title="Szerkesztés">
                                            <Pencil size={15} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => {
                                                if (confirm(`Törli a(z) „${t.name}” sablont?`)) {
                                                    router.delete(route('qa.templates.destroy', t.id), { preserveScroll: true });
                                                }
                                            }}
                                            className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                            title="Törlés"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-ink-soft">
                                {t.items.slice(0, 6).map((i) => (
                                    <li key={i.id} className="flex items-start gap-2">
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50" />
                                        <span>{i.text}</span>
                                    </li>
                                ))}
                                {t.items_count > 6 && <li className="text-xs text-ink-faint">+{t.items_count - 6} további pont…</li>}
                                {t.items_count === 0 && <li className="text-xs text-ink-faint">Nincs ellenőrzési pont.</li>}
                            </ul>

                            <div className="mt-3 text-xs text-ink-faint">
                                {t.items_count} pont · {t.inspections_count} ellenőrzés készült belőle
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal && (
                <TemplateModal template={modal.template} purposes={purposes} onClose={() => setModal(null)} />
            )}
        </>
    );
}

Templates.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
