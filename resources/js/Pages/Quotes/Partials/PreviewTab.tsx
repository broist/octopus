import { useState } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import clsx from 'clsx';
import SavePdfDialog from '@/Pages/Quotes/Partials/SavePdfDialog';
import { calcItem, fmtHuf, fmtPercent } from '@/lib/quote';
import type { ProjectCalc } from '@/lib/quote';
import type { FolderOption, PdfMode, QuoteData } from '@/types/quote';

interface Props {
    quoteId: number;
    data: QuoteData;
    totals: ProjectCalc;
    folders: FolderOption[];
    setField: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void;
}

const SECTION_LABELS: [keyof QuoteData['sections'], string][] = [
    ['includes', 'Tartalmazza'],
    ['excludes', 'Nem tartalmazza'],
    ['assumptions', 'Feltételezések'],
    ['clientData', 'Megrendelői adatszolgáltatás'],
    ['openQuestions', 'Nyitott kérdések'],
    ['nextStep', 'Következő lépés'],
];

export default function PreviewTab({ quoteId, data, totals, folders, setField }: Props) {
    const [saveOpen, setSaveOpen] = useState(false);
    const mode: PdfMode = data.pdfMode ?? 'summary';
    const showQty = !!data.showQuantitiesToCustomer;

    const activeCategories = (data.categories ?? []).filter(
        (c) => c.active && c.items.some((i) => i.active),
    );

    const download = () => {
        const url = route('ajanlatok.pdf.download', { quote: quoteId, mode, theme: 'print' });
        window.open(url, '_blank');
    };

    return (
        <div className="space-y-5">
            {/* PDF-beállítások + műveletek */}
            <div className="o-card flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <div className="mb-1 text-xs font-medium text-ink">PDF tartalma</div>
                        <div className="flex rounded-md border border-line bg-white p-0.5">
                            {(['summary', 'detailed'] as PdfMode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setField('pdfMode', m)}
                                    className={clsx(
                                        'rounded px-3 py-1.5 text-xs font-medium',
                                        mode === m ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink',
                                    )}
                                >
                                    {m === 'summary' ? 'Összesített' : 'Részletes'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="flex items-center gap-2 pb-1.5 text-sm text-ink-soft">
                        <input
                            type="checkbox"
                            checked={showQty}
                            onChange={(e) => setField('showQuantitiesToCustomer', e.target.checked)}
                            className="rounded border-line text-accent focus:ring-accent/40"
                        />
                        Mennyiségek megjelenítése (részletes nézetben)
                    </label>
                </div>

                <div className="flex items-center gap-2">
                    <button className="btn-ghost" onClick={download} title="Mentett állapot letöltése">
                        <Download size={16} />
                        Gyors letöltés
                    </button>
                    <button className="btn-primary" onClick={() => setSaveOpen(true)}>
                        <FolderOpen size={16} />
                        PDF mentése a Fájlkezelőbe
                    </button>
                </div>
            </div>

            {/* Branded ügyfél-előnézet */}
            <div className="o-card overflow-hidden">
                {/* Fejléc (arculati) */}
                <div className="flex items-center justify-between gap-4 bg-[#000B1D] px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-md border border-[#F04A24] p-1">
                            <img src="/brand/acuwall-logo.png" alt="AcuWall" className="h-9 w-9 object-contain" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-lg font-bold">
                                <span className="text-white">Acu</span>
                                <span className="text-[#F04A24]">Wall</span>
                            </div>
                            <div className="text-xs font-semibold text-[#F04A24]">Építsünk együtt</div>
                        </div>
                    </div>
                    <div className="hidden text-right sm:block">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#F04A24]">
                            Kulcsrakész megvalósítás
                        </div>
                        <div className="text-xs font-semibold text-white">
                            Könnyűacélvázas és szendvicspaneles épületek
                        </div>
                        <div className="text-[11px] text-[#AFC0CF]">egy felelős projektvezetéssel</div>
                    </div>
                </div>

                <div className="bg-white px-6 py-6 text-ink">
                    <h1 className="text-2xl font-bold text-[#F04A24]">ÁRAJÁNLAT</h1>

                    {/* Metaadatok */}
                    <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 rounded-lg border border-line bg-cream/50 p-4 text-sm sm:grid-cols-2">
                        <Meta label="Projekt" value={data.projectName} />
                        <Meta label="Ajánlatszám" value={data.quoteNumber} />
                        <Meta label="Megrendelő" value={data.clientName} />
                        <Meta label="Kelte" value={data.quoteDate} />
                        <Meta label="Helyszín" value={data.location} />
                        <Meta label="Érvényesség" value={data.validUntil} />
                    </div>

                    {data.description && (
                        <>
                            <SectionTitle>Projekt összefoglalása</SectionTitle>
                            <p className="whitespace-pre-line text-sm text-ink-soft">{data.description}</p>
                        </>
                    )}

                    <SectionTitle>Ajánlati tartalom</SectionTitle>
                    {activeCategories.length === 0 ? (
                        <p className="text-sm text-ink-faint">Nincs aktív munkanem az ajánlatban.</p>
                    ) : mode === 'detailed' ? (
                        <div className="space-y-4">
                            {activeCategories.map((cat) => {
                                let catOffer = 0;
                                const rows = cat.items
                                    .filter((i) => i.active)
                                    .map((item) => {
                                        const c = calcItem(data, cat, item);
                                        catOffer += c.offer;
                                        return { item, offer: c.offer, qty: c.quantity };
                                    });
                                return (
                                    <div key={cat.id}>
                                        <h3 className="mb-1 text-sm font-semibold text-sidebar">{cat.title}</h3>
                                        <table className="w-full border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-[#F04A24] text-left text-xs text-white">
                                                    <th className="px-3 py-1.5">Műszaki tartalom</th>
                                                    {showQty && <th className="px-3 py-1.5 text-right">Menny.</th>}
                                                    {showQty && <th className="px-3 py-1.5">Egység</th>}
                                                    <th className="px-3 py-1.5 text-right">Nettó összeg</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map(({ item, offer, qty }) => (
                                                    <tr key={item.id} className="border-b border-line">
                                                        <td className="px-3 py-1.5">{item.description}</td>
                                                        {showQty && (
                                                            <td className="px-3 py-1.5 text-right tabular-nums">
                                                                {qty.toLocaleString('hu-HU')}
                                                            </td>
                                                        )}
                                                        {showQty && <td className="px-3 py-1.5">{item.unit}</td>}
                                                        <td className="px-3 py-1.5 text-right tabular-nums">
                                                            {fmtHuf(offer)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-cream font-semibold">
                                                    <td className="px-3 py-1.5" colSpan={showQty ? 3 : 1}>
                                                        Munkanem összesen
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right tabular-nums">
                                                        {fmtHuf(catOffer)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-[#F04A24] text-left text-xs text-white">
                                    <th className="px-3 py-2">Munkanem</th>
                                    <th className="px-3 py-2 text-right">Nettó összeg</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeCategories.map((cat) => {
                                    const offer = cat.items
                                        .filter((i) => i.active)
                                        .reduce((s, i) => s + calcItem(data, cat, i).offer, 0);
                                    return (
                                        <tr key={cat.id} className="border-b border-line">
                                            <td className="px-3 py-2">{cat.title}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{fmtHuf(offer)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Összesítés */}
                    <div className="mt-5 ml-auto max-w-sm overflow-hidden rounded-lg border border-line">
                        <Row label="Nettó ajánlati összeg" value={fmtHuf(totals.netOffer)} />
                        <Row label={`ÁFA (${fmtPercent(data.vatRate)})`} value={fmtHuf(totals.vat)} />
                        <div className="flex items-center justify-between bg-[#011129] px-4 py-2.5 font-bold text-white">
                            <span>Bruttó ajánlati összeg</span>
                            <span className="tabular-nums">{fmtHuf(totals.grossOffer)}</span>
                        </div>
                    </div>

                    {/* Fizetési ütem */}
                    {(data.payments ?? []).length > 0 && (
                        <>
                            <SectionTitle>Fizetési ütemezés</SectionTitle>
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-[#F04A24] text-left text-xs text-white">
                                        <th className="px-3 py-1.5">Mérföldkő</th>
                                        <th className="px-3 py-1.5 text-right">Arány</th>
                                        <th className="px-3 py-1.5 text-right">Nettó összeg</th>
                                        <th className="px-3 py-1.5">Esedékesség</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.payments.map((p) => (
                                        <tr key={p.id} className="border-b border-line">
                                            <td className="px-3 py-1.5">{p.name}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums">
                                                {fmtPercent(Number(p.percent) || 0)}
                                            </td>
                                            <td className="px-3 py-1.5 text-right tabular-nums">
                                                {fmtHuf((totals.netOffer * (Number(p.percent) || 0)) / 100)}
                                            </td>
                                            <td className="px-3 py-1.5 text-ink-soft">{p.condition}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* Feltétel-szekciók */}
                    {SECTION_LABELS.map(([key, label]) => {
                        const text = (data.sections?.[key] ?? '').trim();
                        if (!text) return null;
                        return (
                            <div key={key}>
                                <SectionTitle>{label}</SectionTitle>
                                <p className="whitespace-pre-line text-sm text-ink-soft">{text}</p>
                            </div>
                        );
                    })}

                    {/* Kapcsolat */}
                    <SectionTitle>Kapcsolat</SectionTitle>
                    <p className="text-sm">
                        <b>AcuWall Kft.</b> &nbsp;|&nbsp; acuwall.hu
                    </p>
                    <p className="mt-0.5 font-bold text-[#F04A24]">Építsünk együtt</p>
                    <p className="mt-1 text-xs text-ink-faint">
                        Könnyűacélvázas és szendvicspaneles épületek kulcsrakészen – egy felelős
                        projektvezetéssel, az első ötlettől az átadásig.
                    </p>
                </div>

                {/* Lábléc (arculati) */}
                <div className="flex items-center justify-between border-t-2 border-[#F04A24] bg-[#000B1D] px-6 py-2.5 text-xs text-[#AEBFCE]">
                    <span>
                        <span className="font-bold text-white">Acu</span>
                        <span className="font-bold text-[#F04A24]">Wall</span> &nbsp;|&nbsp; Építsünk együtt
                        &nbsp;|&nbsp; acuwall.hu
                    </span>
                    <span>
                        {data.quoteNumber} &nbsp;|&nbsp; v{data.version}
                    </span>
                </div>
            </div>

            {saveOpen && (
                <SavePdfDialog
                    quoteId={quoteId}
                    data={data}
                    folders={folders}
                    defaultMode={mode}
                    onClose={() => setSaveOpen(false)}
                />
            )}
        </div>
    );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex gap-2">
            <span className="w-24 shrink-0 text-xs text-ink-faint">{label}</span>
            <span className="font-medium text-ink">{value || '–'}</span>
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="mb-1.5 mt-5 border-l-[3px] border-[#F04A24] pl-2 text-sm font-bold uppercase tracking-wide text-sidebar">
            {children}
        </h2>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between border-b border-line bg-cream/40 px-4 py-2 text-sm">
            <span className="text-ink-soft">{label}</span>
            <span className="font-medium tabular-nums text-ink">{value}</span>
        </div>
    );
}
