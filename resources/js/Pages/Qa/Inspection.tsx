import { ReactNode, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, ListPlus, Plus, Trash2, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import DefectModal, { DefectPreset } from '@/Pages/Qa/Partials/DefectModal';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtDate } from '@/lib/format';
import type { InspectionDetail, InspectionResult, Option } from '@/types/models';

interface InspectionProps extends Record<string, unknown> {
    inspection: InspectionDetail;
    results: Record<string, string>;
    purposes: Record<string, string>;
    severities: Record<string, string>;
    statuses: Record<string, string>;
    users: Option[];
    canEdit: boolean;
    canCreateDefect: boolean;
}

interface ItemRow {
    id: number | null;
    text: string;
    result: InspectionResult;
    note: string;
}

interface InspectionFormData {
    title: string;
    purpose: string;
    inspected_on: string;
    status: string;
    note: string;
    items: ItemRow[];
    [key: string]: string | ItemRow[];
}

const selectClass = 'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

const RESULT_STYLE: Record<InspectionResult, string> = {
    nyitott: 'border-line bg-white text-ink-soft',
    megfelelt: 'border-accent bg-accent-50 text-accent-700',
    nem_megfelelt: 'border-coral bg-coral/10 text-coral',
    na: 'border-line bg-cream text-ink-soft',
};

export default function InspectionPage() {
    const { inspection, results, purposes, severities, statuses, users, canEdit, canCreateDefect } =
        usePageProps<InspectionProps>();
    const [defectPreset, setDefectPreset] = useState<DefectPreset | null>(null);

    const form = useForm<InspectionFormData>({
        title: inspection.title,
        purpose: inspection.purpose,
        inspected_on: inspection.inspected_on,
        status: inspection.status,
        note: inspection.note ?? '',
        items: inspection.items.map((i) => ({ id: i.id, text: i.text, result: i.result, note: i.note ?? '' })),
    });

    const setItem = (idx: number, patch: Partial<ItemRow>) =>
        form.setData('items', form.data.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    const addItem = () => form.setData('items', [...form.data.items, { id: null, text: '', result: 'nyitott', note: '' }]);
    const removeItem = (idx: number) => form.setData('items', form.data.items.filter((_, i) => i !== idx));

    const save = () => {
        form.transform((d) => ({
            ...d,
            items: (d.items as ItemRow[]).filter((it) => it.text.trim() !== ''),
        }));
        form.put(route('qa.inspections.update', inspection.id), { preserveScroll: true });
    };

    const passed = form.data.items.filter((i) => i.result === 'megfelelt').length;
    const failed = form.data.items.filter((i) => i.result === 'nem_megfelelt').length;

    return (
        <>
            <Head title={`Ellenőrzés – ${inspection.title}`} />

            <PageHeader
                title={inspection.title}
                subtitle={inspection.project ? `${inspection.project.code} – ${inspection.project.name} · ${fmtDate(inspection.inspected_on)}` : undefined}
                actions={
                    <>
                        <Link href={route('qa.inspections.index')} className="btn-ghost">
                            <ArrowLeft size={16} />
                            Lista
                        </Link>
                        {canEdit && (
                            <button className="btn-primary" onClick={save} disabled={form.processing}>
                                Mentés
                            </button>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    {/* Tételek */}
                    <div className="o-card p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-sidebar">Ellenőrzési pontok</h2>
                            <span className="text-xs text-ink-faint">
                                {passed} megfelelt · {failed} nem megfelelt · {form.data.items.length} összesen
                            </span>
                        </div>

                        <div className="space-y-3">
                            {form.data.items.map((item, idx) => (
                                <div key={idx} className="rounded-lg border border-line p-3">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="text"
                                            value={item.text}
                                            onChange={(e) => setItem(idx, { text: e.target.value })}
                                            placeholder={`${idx + 1}. ellenőrzési pont`}
                                            className={selectClass}
                                            disabled={!canEdit}
                                        />
                                        {canEdit && (
                                            <button onClick={() => removeItem(idx)} className="btn-ghost !p-2 text-coral hover:bg-coral/10" title="Törlés">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {(Object.keys(results) as InspectionResult[]).map((r) => (
                                            <button
                                                key={r}
                                                type="button"
                                                disabled={!canEdit}
                                                onClick={() => setItem(idx, { result: r })}
                                                className={clsx(
                                                    'rounded-md border px-2.5 py-1 text-xs font-medium transition',
                                                    item.result === r ? RESULT_STYLE[r] : 'border-line bg-white text-ink-faint hover:border-accent/40',
                                                )}
                                            >
                                                {results[r]}
                                            </button>
                                        ))}
                                        <input
                                            type="text"
                                            value={item.note}
                                            onChange={(e) => setItem(idx, { note: e.target.value })}
                                            placeholder="megjegyzés"
                                            className="ml-auto min-w-0 flex-1 rounded-md border-line bg-white py-1 text-xs focus:border-accent focus:ring-accent/30"
                                            disabled={!canEdit}
                                        />
                                        {item.result === 'nem_megfelelt' && canCreateDefect && (
                                            <button
                                                type="button"
                                                onClick={() => setDefectPreset({
                                                    project_id: inspection.project?.id ?? null,
                                                    inspection_id: inspection.id,
                                                    title: item.text,
                                                })}
                                                className="btn-ghost !py-1 text-xs text-coral"
                                                title="Hiba nyitása ebből a pontból"
                                            >
                                                <ListPlus size={13} />
                                                Hiba
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {form.data.items.length === 0 && (
                                <p className="text-sm text-ink-faint">Nincs ellenőrzési pont — adjon hozzá lentebb.</p>
                            )}
                        </div>

                        {canEdit && (
                            <button onClick={addItem} className="btn-ghost mt-3 text-sm text-accent">
                                <Plus size={15} />
                                Pont hozzáadása
                            </button>
                        )}
                    </div>

                    {/* Kapcsolódó hibák */}
                    {inspection.defects.length > 0 && (
                        <div className="o-card p-5">
                            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar">
                                <TriangleAlert size={15} className="text-coral" />
                                Ebből nyitott hibák
                            </h2>
                            <ul className="divide-y divide-line">
                                {inspection.defects.map((d) => (
                                    <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                                        <span className="min-w-0">
                                            <span className="text-ink">{d.title}</span>
                                            {d.responsible_name && <span className="block text-xs text-ink-faint">Felelős: {d.responsible_name}</span>}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            {d.due_on && <span className="text-xs text-ink-faint">{fmtDate(d.due_on)}</span>}
                                            <Link href={route('qa.index')} className="chip chip-grey hover:text-accent">{d.status_label}</Link>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Oldalsáv: meta */}
                <div className="o-card space-y-3 self-start p-5">
                    <h2 className="text-sm font-semibold text-sidebar">Adatok</h2>
                    <div>
                        <label className="text-xs font-medium text-ink-soft">Megnevezés</label>
                        <input type="text" value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} className={selectClass} disabled={!canEdit} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-ink-soft">Cél</label>
                        <select value={form.data.purpose} onChange={(e) => form.setData('purpose', e.target.value)} className={selectClass} disabled={!canEdit}>
                            {Object.entries(purposes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-ink-soft">Dátum</label>
                        <input type="date" value={form.data.inspected_on} onChange={(e) => form.setData('inspected_on', e.target.value)} className={selectClass} disabled={!canEdit} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-ink-soft">Státusz</label>
                        <select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)} className={selectClass} disabled={!canEdit}>
                            <option value="folyamatban">Folyamatban</option>
                            <option value="lezart">Lezárt</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-ink-soft">Megjegyzés</label>
                        <textarea value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} rows={3} className={selectClass} disabled={!canEdit} />
                    </div>
                    {inspection.creator_name && <p className="text-xs text-ink-faint">Készítette: {inspection.creator_name}</p>}

                    {canEdit && (
                        <button
                            onClick={() => {
                                if (confirm('Törli ezt az ellenőrzést?')) {
                                    router.delete(route('qa.inspections.destroy', inspection.id));
                                }
                            }}
                            className="btn inline-flex w-full justify-center border border-coral/40 bg-white text-sm text-coral hover:bg-coral/10"
                        >
                            <Trash2 size={14} />
                            Ellenőrzés törlése
                        </button>
                    )}
                </div>
            </div>

            {defectPreset && inspection.project && (
                <DefectModal
                    defect={null}
                    preset={defectPreset}
                    projects={[inspection.project]}
                    users={users}
                    statuses={statuses}
                    severities={severities}
                    onClose={() => setDefectPreset(null)}
                />
            )}
        </>
    );
}

InspectionPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
