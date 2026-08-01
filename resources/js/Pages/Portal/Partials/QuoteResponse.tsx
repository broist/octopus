import { FormEventHandler, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { CheckCircle2, FileText, ThumbsDown, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { fmtHuf } from '@/lib/quote';
import type { PortalQuote } from '@/types/portal';

/**
 * Egy árajánlat kártyája az ügyfélportálon: PDF megnyitása, majd elfogadás
 * vagy elutasítás — utóbbihoz megjegyzést is fűzhet a megrendelő.
 *
 * Nyilatkozni csak véglegesített ajánlatra lehet, és csak egyszer: ha közben
 * új verzió készül, a válasz nullázódik, és újra nyitottá válik.
 */
export default function QuoteResponse({ quote }: { quote: PortalQuote }) {
    const [choice, setChoice] = useState<'elfogadva' | 'elutasitva' | null>(null);

    const form = useForm({ response: '', note: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('ugyfel.ajanlat.valasz', quote.id), {
            preserveScroll: true,
            onSuccess: () => {
                setChoice(null);
                form.reset();
            },
        });
    };

    const start = (value: 'elfogadva' | 'elutasitva') => {
        setChoice(value);
        form.setData('response', value);
    };

    const answered = quote.response !== null;
    const accepted = quote.response === 'elfogadva';

    return (
        <section className="o-card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {quote.quote_number && (
                            <span className="font-mono text-xs text-ink-faint">
                                {quote.quote_number}
                            </span>
                        )}
                        <span className="chip chip-grey">v{quote.version}</span>
                        {!quote.is_final && <span className="chip chip-amber">Előkészítés alatt</span>}
                        {answered && (
                            <span
                                className={clsx('chip', accepted ? 'chip-green' : 'chip-coral')}
                            >
                                {accepted ? (
                                    <CheckCircle2 size={12} />
                                ) : (
                                    <XCircle size={12} />
                                )}
                                {quote.response_label}
                            </span>
                        )}
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-sidebar">{quote.title}</h3>
                    {quote.valid_until && (
                        <p className="mt-0.5 text-xs text-ink-faint">
                            Érvényes: {quote.valid_until}
                        </p>
                    )}
                </div>

                <div className="text-right">
                    <div className="text-xs text-ink-faint">Bruttó ajánlati összeg</div>
                    <div className="text-lg font-semibold tabular-nums text-sidebar">
                        {fmtHuf(quote.gross_offer)}
                    </div>
                    <div className="text-xs text-ink-faint">
                        nettó {fmtHuf(quote.net_offer)}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                <a
                    href={route('ugyfel.ajanlat.pdf', quote.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost"
                >
                    <FileText size={16} />
                    Árajánlat megnyitása (PDF)
                </a>

                {quote.is_final && !answered && choice === null && (
                    <>
                        <button className="btn-primary" onClick={() => start('elfogadva')}>
                            <CheckCircle2 size={16} />
                            Elfogadom
                        </button>
                        <button
                            className="btn border border-line bg-white text-ink-soft hover:bg-cream"
                            onClick={() => start('elutasitva')}
                        >
                            <ThumbsDown size={16} />
                            Most nem
                        </button>
                    </>
                )}
            </div>

            {/* Nyilatkozat űrlap */}
            {choice !== null && (
                <form onSubmit={submit} className="border-t border-line bg-cream/50 px-5 py-4">
                    <p className="text-sm font-medium text-ink">
                        {choice === 'elfogadva'
                            ? 'Elfogadja ezt az árajánlatot?'
                            : 'Elutasítja ezt az árajánlatot?'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                        {choice === 'elfogadva'
                            ? 'Kollégánk értesítést kap, és felveszi Önnel a kapcsolatot a szerződéskötésről.'
                            : 'Ha leírja, mi az akadály, könnyebben tudunk új ajánlatot készíteni.'}
                    </p>

                    <textarea
                        value={form.data.note}
                        onChange={(e) => form.setData('note', e.target.value)}
                        rows={3}
                        placeholder="Megjegyzés (nem kötelező)"
                        className="mt-3 w-full rounded-lg border-line bg-white text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-accent/30"
                    />
                    {form.errors.note && (
                        <p className="mt-1 text-xs text-coral">{form.errors.note}</p>
                    )}
                    {form.errors.response && (
                        <p className="mt-1 text-xs text-coral">{form.errors.response}</p>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                        <button className="btn-primary" disabled={form.processing}>
                            {choice === 'elfogadva' ? 'Elfogadás véglegesítése' : 'Elutasítás elküldése'}
                        </button>
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setChoice(null)}
                            disabled={form.processing}
                        >
                            Mégsem
                        </button>
                    </div>
                </form>
            )}

            {/* Korábbi válasz */}
            {answered && (
                <div className="border-t border-line bg-cream/50 px-5 py-3 text-sm">
                    <span className="text-ink-soft">
                        Válasza rögzítve: <b className="text-ink">{quote.response_label}</b>
                        {quote.responded_at && ` · ${fmtDateTime(quote.responded_at)}`}
                    </span>
                    {quote.response_note && (
                        <p className="mt-1 whitespace-pre-line text-ink-soft">
                            „{quote.response_note}”
                        </p>
                    )}
                </div>
            )}

            {!quote.is_final && (
                <div className="border-t border-line px-5 py-3 text-xs text-ink-faint">
                    Ez az ajánlat még nem végleges — amint elkészül, itt tud majd nyilatkozni róla.
                    Utolsó frissítés: {fmtDate(quote.updated_at)}
                </div>
            )}
        </section>
    );
}
