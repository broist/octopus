import { FormEventHandler } from 'react';
import { useForm } from '@inertiajs/react';
import { CheckCircle2, Eye, EyeOff, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { fmtDateTime } from '@/lib/format';

export interface QuoteClientSharing {
    project_id: number | null;
    visible: boolean;
    response: string | null;
    response_label: string | null;
    response_note: string | null;
    responded_at: string | null;
}

export interface QuoteProjectOption {
    id: number;
    code: string;
    name: string;
    client_name: string | null;
}

interface Props {
    quoteId: number;
    sharing: QuoteClientSharing;
    projects: QuoteProjectOption[];
    isFinal: boolean;
    canEdit: boolean;
}

/**
 * Az ajánlat megosztása az ügyfélportálon.
 *
 * A projekt-hozzárendelés adja a jogosultsági láncot: az ajánlatot az a
 * megrendelő látja, akié a projekt — külön címzettlistát nem kell vezetni.
 */
export default function PortalShareCard({ quoteId, sharing, projects, isFinal, canEdit }: Props) {
    const form = useForm({
        project_id: sharing.project_id ? String(sharing.project_id) : '',
        client_visible: sharing.visible,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        form.transform((data) => ({
            project_id: data.project_id === '' ? null : Number(data.project_id),
            client_visible: data.client_visible,
        }));
        form.put(route('ajanlatok.client-sharing', quoteId), { preserveScroll: true });
    };

    const answered = sharing.response !== null;
    const accepted = sharing.response === 'elfogadva';

    return (
        <form onSubmit={submit} className="o-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-sidebar">Ügyfélportál</h2>
                    <p className="mt-1 text-sm text-ink-soft">
                        Megosztva a megrendelő a fenti PDF-et nyithatja meg, és online
                        elfogadhatja vagy elutasíthatja az ajánlatot.
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
                            Megosztva
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-ink-faint">
                            <EyeOff size={16} />
                            Rejtve
                        </span>
                    )}
                </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="quote_project" className="mb-1 block text-sm font-medium text-ink">
                        Projekt
                    </label>
                    <select
                        id="quote_project"
                        value={form.data.project_id}
                        disabled={!canEdit}
                        onChange={(e) => form.setData('project_id', e.target.value)}
                        className="w-full rounded-lg border-line bg-white text-sm text-ink focus:border-accent focus:ring-accent/30"
                    >
                        <option value="">– nincs projekthez kötve –</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.code} · {p.name}
                                {p.client_name ? ` (${p.client_name})` : ''}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-ink-faint">
                        Az ajánlatot a projekt megrendelője látja — megosztáshoz projekt kell.
                    </p>
                    {form.errors.project_id && (
                        <p className="mt-1 text-xs text-coral">{form.errors.project_id}</p>
                    )}
                </div>

                <div>
                    <div className="mb-1 text-sm font-medium text-ink">Ügyfél visszajelzése</div>
                    {answered ? (
                        <div className="rounded-lg border border-line bg-cream/50 px-3 py-2 text-sm">
                            <span
                                className={clsx(
                                    'chip',
                                    accepted ? 'chip-green' : 'chip-coral',
                                )}
                            >
                                {accepted ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                {sharing.response_label}
                            </span>
                            {sharing.responded_at && (
                                <span className="ml-2 text-xs text-ink-faint">
                                    {fmtDateTime(sharing.responded_at)}
                                </span>
                            )}
                            {sharing.response_note && (
                                <p className="mt-1.5 whitespace-pre-line text-ink-soft">
                                    „{sharing.response_note}”
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="rounded-lg border border-line bg-cream/50 px-3 py-2 text-sm text-ink-faint">
                            {isFinal
                                ? 'Még nem érkezett válasz.'
                                : 'Az ügyfél csak jóváhagyott (végleges) ajánlatra tud nyilatkozni.'}
                        </p>
                    )}
                </div>
            </div>

            {canEdit && (
                <div className="mt-4 flex items-center gap-3">
                    <button className="btn-primary" disabled={form.processing}>
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
