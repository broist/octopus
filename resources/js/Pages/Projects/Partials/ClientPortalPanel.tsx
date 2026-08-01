import { FormEventHandler, useState } from 'react';
import { Link, useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, Images, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { CATEGORY_LABELS } from '@/lib/documents';
import type { ClientSharing, ProjectDocumentRow } from '@/types/models';

interface Props {
    projectId: number;
    sharing: ClientSharing;
    documents: ProjectDocumentRow[];
    canEdit: boolean;
}

function toggle(list: number[], id: number): number[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * „Ügyfélportál" fül a projekt adatlapján — egy helyen dől el, mit lát a
 * megrendelő. Minden kapcsoló alapból ki van kapcsolva; ami itt nincs
 * bepipálva, az a portálon nem is létezik.
 */
export default function ClientPortalPanel({ projectId, sharing, documents, canEdit }: Props) {
    const [documentIds, setDocumentIds] = useState<number[]>(
        documents.filter((d) => d.client_visible).map((d) => d.id),
    );
    const [reportIds, setReportIds] = useState<number[]>(
        sharing.reports.filter((r) => r.client_visible).map((r) => r.id),
    );

    const form = useForm({
        client_visible: sharing.enabled,
        client_summary: sharing.summary ?? '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, documents: documentIds, reports: reportIds }));
        form.put(route('projects.client-sharing', projectId), { preserveScroll: true });
    };

    if (!sharing.client_id) {
        return (
            <div className="o-card px-6 py-12 text-center">
                <h3 className="text-base font-semibold text-sidebar">Nincs megrendelő a projekten</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                    Az ügyfélportál a megrendelőhöz kötődik. Válasszon megrendelőt a projekt
                    adatainál, utána tudja megosztani vele a munkát.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            {/* Fő kapcsoló */}
            <section className="o-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-sidebar">
                            Megosztás a megrendelővel
                        </h3>
                        <p className="mt-1 text-sm text-ink-soft">
                            {sharing.client_name} az ügyfélportálon a projekt készültségét, az
                            ütemtervet és a lent kijelölt tartalmat látja. Belső jegyzet, költség
                            és alvállalkozói adat soha nem kerül ki.
                        </p>
                    </div>

                    <label className="flex shrink-0 items-center gap-2.5 text-sm font-medium text-ink">
                        <input
                            type="checkbox"
                            checked={form.data.client_visible}
                            disabled={!canEdit}
                            onChange={(e) => form.setData('client_visible', e.target.checked)}
                            className="h-5 w-5 rounded border-line text-accent focus:ring-accent/40"
                        />
                        {form.data.client_visible ? (
                            <span className="inline-flex items-center gap-1.5 text-accent">
                                <Eye size={16} />
                                Látható
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 text-ink-faint">
                                <EyeOff size={16} />
                                Rejtve
                            </span>
                        )}
                    </label>
                </div>

                {form.data.client_visible && !sharing.has_access && (
                    <p className="mt-4 flex items-start gap-2 rounded-lg border border-amberwarn/30 bg-amberwarn/10 px-3 py-2 text-sm text-[#8a5e17]">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>
                            {sharing.client_name} még nem tud belépni.{' '}
                            <Link
                                href={route('crm.show', sharing.client_id)}
                                className="font-medium underline"
                            >
                                Adjon neki portál-hozzáférést
                            </Link>{' '}
                            a partner adatlapján.
                        </span>
                    </p>
                )}

                <div className="mt-4">
                    <label
                        htmlFor="client_summary"
                        className="mb-1 block text-sm font-medium text-ink"
                    >
                        Összefoglaló az ügyfélnek
                    </label>
                    <textarea
                        id="client_summary"
                        rows={3}
                        value={form.data.client_summary}
                        disabled={!canEdit}
                        onChange={(e) => form.setData('client_summary', e.target.value)}
                        placeholder="Pár mondat a munkáról a megrendelő nyelvén — ez jelenik meg a portál nyitóoldalán. A belső leírás nem kerül ki."
                        className="w-full rounded-lg border-line bg-white text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-accent/30"
                    />
                    {form.errors.client_summary && (
                        <p className="mt-1 text-xs text-coral">{form.errors.client_summary}</p>
                    )}
                </div>
            </section>

            {/* Dokumentumok */}
            <section className="o-card">
                <header className="flex items-center justify-between border-b border-line px-5 py-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                        Megosztott dokumentumok
                    </h3>
                    <span className="text-xs text-ink-faint">
                        {documentIds.length} / {documents.length}
                    </span>
                </header>

                {documents.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-ink-faint">
                        Ehhez a projekthez még nincs dokumentum. A Fájlkezelőben tölthet fel
                        fájlt, és kötheti ehhez a projekthez.
                    </p>
                ) : (
                    <div className="divide-y divide-line">
                        {documents.map((d) => (
                            <label
                                key={d.id}
                                className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-cream/50"
                            >
                                <input
                                    type="checkbox"
                                    checked={documentIds.includes(d.id)}
                                    disabled={!canEdit}
                                    onChange={() => setDocumentIds((ids) => toggle(ids, d.id))}
                                    className="rounded border-line text-accent focus:ring-accent/40"
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                    {d.title}
                                </span>
                                <span className="chip chip-grey shrink-0">
                                    {CATEGORY_LABELS[d.category] ?? d.category}
                                </span>
                                <span className="hidden shrink-0 text-xs text-ink-faint sm:block">
                                    {fmtDate(d.updated_at)}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </section>

            {/* Napi jelentések */}
            <section className="o-card">
                <header className="flex items-center justify-between border-b border-line px-5 py-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                        Haladás-napló (napi jelentések)
                    </h3>
                    <span className="text-xs text-ink-faint">
                        {reportIds.length} / {sharing.reports.length}
                    </span>
                </header>

                {sharing.reports.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-ink-faint">
                        Még nincs napi jelentés ezen a projekten.
                    </p>
                ) : (
                    <>
                        <p className="border-b border-line px-5 py-2 text-xs text-ink-faint">
                            Az ügyfél a dátumot, az elvégzett munkát és a fotókat látja — az
                            akadályok, a létszám és a gép-/anyagmozgás belső marad.
                        </p>
                        <div className="divide-y divide-line">
                            {sharing.reports.map((r) => (
                                <label
                                    key={r.id}
                                    className="flex cursor-pointer items-start gap-3 px-5 py-2.5 hover:bg-cream/50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={reportIds.includes(r.id)}
                                        disabled={!canEdit}
                                        onChange={() => setReportIds((ids) => toggle(ids, r.id))}
                                        className="mt-0.5 rounded border-line text-accent focus:ring-accent/40"
                                    />
                                    <span className="w-24 shrink-0 text-sm font-medium text-ink">
                                        {fmtDate(r.report_date)}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                                        {r.work_done ?? '–'}
                                    </span>
                                    {r.photos_count > 0 && (
                                        <span className="chip chip-grey shrink-0">
                                            <Images size={12} />
                                            {r.photos_count}
                                        </span>
                                    )}
                                </label>
                            ))}
                        </div>
                    </>
                )}
            </section>

            {/* Árajánlatok — a megosztás az ajánlat szerkesztőjében kapcsolható */}
            <section className="o-card">
                <header className="border-b border-line px-5 py-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                        Árajánlatok
                    </h3>
                </header>

                {sharing.quotes.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-ink-faint">
                        Ehhez a projekthez nincs hozzárendelt árajánlat. Az Ajánlatkérőben, az
                        „Ügyfél nézet" fülön kötheti az ajánlatot ehhez a projekthez.
                    </p>
                ) : (
                    <div className="divide-y divide-line">
                        {sharing.quotes.map((q) => (
                            <div key={q.id} className="flex items-center gap-3 px-5 py-2.5">
                                <span
                                    className={clsx(
                                        'shrink-0',
                                        q.client_visible ? 'text-accent' : 'text-ink-faint',
                                    )}
                                    title={q.client_visible ? 'Látható a portálon' : 'Rejtve'}
                                >
                                    {q.client_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                </span>
                                {q.quote_number && (
                                    <span className="shrink-0 font-mono text-xs text-ink-faint">
                                        {q.quote_number}
                                    </span>
                                )}
                                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                    {q.project_name}
                                </span>
                                {q.response && (
                                    <span
                                        className={clsx(
                                            'chip shrink-0',
                                            q.response === 'elfogadva' ? 'chip-green' : 'chip-coral',
                                        )}
                                        title={
                                            q.responded_at
                                                ? `Válasz: ${fmtDateTime(q.responded_at)}`
                                                : undefined
                                        }
                                    >
                                        {q.response === 'elfogadva' ? (
                                            <CheckCircle2 size={12} />
                                        ) : (
                                            <XCircle size={12} />
                                        )}
                                        {q.response_label}
                                    </span>
                                )}
                                <Link
                                    href={route('ajanlatok.show', { quote: q.id, tab: 'ugyfel' })}
                                    className="shrink-0 text-ink-faint hover:text-accent"
                                    title="Megnyitás az Ajánlatkérőben"
                                >
                                    <ExternalLink size={15} />
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {canEdit && (
                <div className="flex items-center gap-3">
                    <button type="submit" className="btn-primary" disabled={form.processing}>
                        Megosztás mentése
                    </button>
                    {form.recentlySuccessful && (
                        <span className="text-sm text-accent">Mentve.</span>
                    )}
                </div>
            )}
        </form>
    );
}
