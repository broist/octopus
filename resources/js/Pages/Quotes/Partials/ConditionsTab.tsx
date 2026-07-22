import InputLabel from '@/Components/ui/InputLabel';
import type { QuoteData, QuoteSections } from '@/types/quote';

interface Props {
    data: QuoteData;
    readOnly: boolean;
    setField: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void;
}

const taCls =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40 disabled:bg-cream/60';

const SECTIONS: { key: keyof QuoteSections; label: string; hint: string }[] = [
    { key: 'includes', label: 'Tartalmazza', hint: 'Mit fed le az ajánlat.' },
    { key: 'excludes', label: 'Nem tartalmazza', hint: 'Mi nem része az ajánlatnak.' },
    { key: 'assumptions', label: 'Feltételezések', hint: 'Milyen feltételek mellett érvényes.' },
    { key: 'clientData', label: 'Megrendelői adatszolgáltatás', hint: 'Amit a megrendelőnek biztosítania kell.' },
    { key: 'openQuestions', label: 'Nyitott kérdések', hint: 'Tisztázandó pontok.' },
    { key: 'nextStep', label: 'Következő lépés', hint: 'Hogyan tovább az ajánlat után.' },
];

export default function ConditionsTab({ data, readOnly, setField }: Props) {
    const setSection = (key: keyof QuoteSections, value: string) => {
        setField('sections', { ...(data.sections ?? {}), [key]: value });
    };

    return (
        <div className="space-y-5">
            <div className="o-card p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                    Összefoglaló
                </h2>
                <div className="space-y-3">
                    <div>
                        <InputLabel value="Projekt összefoglalása (az ügyfél-PDF elején jelenik meg)" />
                        <textarea
                            rows={3}
                            className={taCls}
                            value={data.description ?? ''}
                            disabled={readOnly}
                            onChange={(e) => setField('description', e.target.value)}
                        />
                    </div>
                    <div>
                        <InputLabel value="Belső megjegyzés (nem kerül az ügyfél-PDF-be)" />
                        <textarea
                            rows={2}
                            className={taCls}
                            value={data.notes ?? ''}
                            disabled={readOnly}
                            onChange={(e) => setField('notes', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="o-card p-5">
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                    Ajánlati feltételek
                </h2>
                <p className="mb-4 text-xs text-ink-faint">
                    Minden kitöltött szekció külön blokként jelenik meg az ügyfél-PDF-ben.
                </p>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {SECTIONS.map((s) => (
                        <div key={s.key}>
                            <InputLabel value={s.label} />
                            <textarea
                                rows={3}
                                className={taCls}
                                placeholder={s.hint}
                                value={data.sections?.[s.key] ?? ''}
                                disabled={readOnly}
                                onChange={(e) => setSection(s.key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
