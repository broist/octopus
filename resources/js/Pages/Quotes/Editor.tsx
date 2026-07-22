import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Calculator,
    CheckCircle2,
    ClipboardCheck,
    Eye,
    Percent,
    Save,
    Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import { usePageProps } from '@/hooks/usePageProps';
import CalculationTab from '@/Pages/Quotes/Partials/CalculationTab';
import ConditionsTab from '@/Pages/Quotes/Partials/ConditionsTab';
import PaymentsTab from '@/Pages/Quotes/Partials/PaymentsTab';
import PreviewTab from '@/Pages/Quotes/Partials/PreviewTab';
import { calcProject, fmtHuf } from '@/lib/quote';
import type { QuoteCategory, QuoteData, QuoteItem, FolderOption } from '@/types/quote';

interface EditorProps extends Record<string, unknown> {
    quote: {
        id: number;
        status: string;
        version: number;
        updated_at: string;
        approved_at: string | null;
        data: QuoteData;
    };
    tab: string;
    folders: FolderOption[];
    can: { edit: boolean; delete: boolean };
}

type TabKey = 'kalkulacio' | 'feltetelek' | 'fizetes' | 'ugyfel';

const TABS: { key: TabKey; label: string; icon: typeof Calculator }[] = [
    { key: 'kalkulacio', label: 'Kalkuláció', icon: Calculator },
    { key: 'feltetelek', label: 'Feltételek', icon: ClipboardCheck },
    { key: 'fizetes', label: 'Fizetési ütem', icon: Percent },
    { key: 'ugyfel', label: 'Ügyfél nézet', icon: Eye },
];

function newItem(): QuoteItem {
    return {
        id: 'item-' + Math.random().toString(36).slice(2, 9),
        code: '',
        description: 'Új tétel',
        quantity: 0,
        unit: 'db',
        ownMaterialUnit: 0,
        ownLaborUnit: 0,
        subMaterialUnit: 0,
        subLaborUnit: 0,
        manualBase: 0,
        basis: 'own',
        profitOverride: false,
        profitMode: 'markup',
        profitValue: 0,
        active: true,
        internalNote: '',
    };
}

function newCategory(): QuoteCategory {
    return {
        id: 'cat-' + Math.random().toString(36).slice(2, 9),
        code: '',
        title: 'Új munkanem',
        active: true,
        collapsed: false,
        profitOverride: false,
        profitMode: 'markup',
        profitValue: 0,
        items: [],
    };
}

export default function Editor() {
    const { quote, tab, folders, can } = usePageProps<EditorProps>();

    const [data, setData] = useState<QuoteData>(quote.data);
    const [activeTab, setActiveTab] = useState<TabKey>(
        (TABS.find((t) => t.key === tab)?.key ?? 'kalkulacio') as TabKey,
    );
    const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');
    const dirtyRef = useRef(false);
    const approved = quote.status === 'jóváhagyva';

    const totals = useMemo(() => calcProject(data), [data]);

    /* ---- Állapot-frissítők (immutábilis) ---- */
    const touch = () => {
        dirtyRef.current = true;
        setSaveState('dirty');
    };

    const setField = useCallback(<K extends keyof QuoteData>(key: K, value: QuoteData[K]) => {
        setData((d) => ({ ...d, [key]: value }));
        touch();
    }, []);

    const setCategory = useCallback((ci: number, patch: Partial<QuoteCategory>) => {
        setData((d) => {
            const categories = d.categories.slice();
            categories[ci] = { ...categories[ci], ...patch };
            return { ...d, categories };
        });
        touch();
    }, []);

    const setItem = useCallback((ci: number, ii: number, patch: Partial<QuoteItem>) => {
        setData((d) => {
            const categories = d.categories.slice();
            const items = categories[ci].items.slice();
            items[ii] = { ...items[ii], ...patch };
            categories[ci] = { ...categories[ci], items };
            return { ...d, categories };
        });
        touch();
    }, []);

    const addCategory = useCallback(() => {
        setData((d) => ({ ...d, categories: [...d.categories, newCategory()] }));
        touch();
    }, []);

    const removeCategory = useCallback((ci: number) => {
        setData((d) => ({ ...d, categories: d.categories.filter((_, i) => i !== ci) }));
        touch();
    }, []);

    const addItem = useCallback((ci: number) => {
        setData((d) => {
            const categories = d.categories.slice();
            categories[ci] = { ...categories[ci], items: [...categories[ci].items, newItem()] };
            return { ...d, categories };
        });
        touch();
    }, []);

    const duplicateItem = useCallback((ci: number, ii: number) => {
        setData((d) => {
            const categories = d.categories.slice();
            const items = categories[ci].items.slice();
            const copy = { ...items[ii], id: 'item-' + Math.random().toString(36).slice(2, 9) };
            items.splice(ii + 1, 0, copy);
            categories[ci] = { ...categories[ci], items };
            return { ...d, categories };
        });
        touch();
    }, []);

    const removeItem = useCallback((ci: number, ii: number) => {
        setData((d) => {
            const categories = d.categories.slice();
            categories[ci] = {
                ...categories[ci],
                items: categories[ci].items.filter((_, i) => i !== ii),
            };
            return { ...d, categories };
        });
        touch();
    }, []);

    /* ---- Mentés (kézi + automatikus, csak szerkesztési joggal) ---- */
    const save = useCallback(
        (silent = false) => {
            if (!can.edit) return;
            setSaveState('saving');
            router.put(
                route('ajanlatok.update', quote.id),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { data } as any,
                {
                    preserveScroll: true,
                    preserveState: true,
                    only: ['flash'],
                    onSuccess: () => {
                        dirtyRef.current = false;
                        setSaveState('saved');
                    },
                    onError: () => setSaveState('dirty'),
                },
            );
            void silent;
        },
        [can.edit, data, quote.id],
    );

    // Automatikus mentés 1,8 mp tétlenség után.
    useEffect(() => {
        if (!can.edit || !dirtyRef.current) return;
        const t = setTimeout(() => save(true), 1800);
        return () => clearTimeout(t);
    }, [data, can.edit, save]);

    const switchTab = (key: TabKey) => {
        setActiveTab(key);
        window.history.replaceState(null, '', route('ajanlatok.show', { quote: quote.id, tab: key }));
    };

    const approve = () => {
        if (!confirm('Jóváhagyja az árajánlatot? A rendszer pillanatképet ment a jelenlegi verzióról.')) return;
        router.post(
            route('ajanlatok.approve', quote.id),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { data } as any,
            { preserveScroll: true, onSuccess: () => setSaveState('saved') },
        );
    };

    const destroy = () => {
        if (confirm(`Biztosan törli a(z) „${data.projectName}” árajánlatot?`)) {
            router.delete(route('ajanlatok.destroy', quote.id));
        }
    };

    return (
        <>
            <Head title={data.projectName || 'Árajánlat'} />

            <Link
                href={route('ajanlatok.index')}
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza az ajánlatokhoz
            </Link>

            {/* Fejléc */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="truncate text-2xl font-semibold tracking-tight text-sidebar">
                            {data.projectName || 'Névtelen árajánlat'}
                        </h1>
                        {approved ? (
                            <span className="chip inline-flex items-center gap-1 bg-accent-50 text-accent-700">
                                <CheckCircle2 size={12} />
                                Jóváhagyva · v{quote.version}
                            </span>
                        ) : (
                            <span className="chip chip-grey">Piszkozat</span>
                        )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
                        {data.quoteNumber && <span className="font-mono text-xs">{data.quoteNumber}</span>}
                        <span>
                            Nettó: <span className="font-semibold text-ink">{fmtHuf(totals.netOffer)}</span>
                        </span>
                        <span>
                            Bruttó: <span className="font-semibold text-ink">{fmtHuf(totals.grossOffer)}</span>
                        </span>
                    </div>
                </div>

                {can.edit && (
                    <div className="flex shrink-0 items-center gap-2">
                        <span
                            className={clsx(
                                'text-xs font-medium',
                                saveState === 'saved' && 'text-accent',
                                saveState === 'dirty' && 'text-amberwarn',
                                saveState === 'saving' && 'text-ink-faint',
                            )}
                        >
                            {saveState === 'saved' ? 'Mentve' : saveState === 'saving' ? 'Mentés…' : 'Nem mentett'}
                        </span>
                        <button className="btn-ghost" onClick={() => save(false)} disabled={saveState === 'saving'}>
                            <Save size={16} />
                            Mentés
                        </button>
                        <button className="btn-primary" onClick={approve}>
                            <CheckCircle2 size={16} />
                            Jóváhagyás
                        </button>
                        {can.delete && (
                            <button
                                onClick={destroy}
                                className="btn border border-coral/40 bg-white text-coral hover:bg-coral/10"
                                title="Törlés"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Fülek */}
            <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
                {TABS.map((t) => {
                    const Icon = t.icon;
                    const active = activeTab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => switchTab(t.key)}
                            className={clsx(
                                'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition',
                                active
                                    ? 'border-accent text-accent'
                                    : 'border-transparent text-ink-soft hover:text-ink',
                            )}
                        >
                            <Icon size={15} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'kalkulacio' && (
                <CalculationTab
                    data={data}
                    totals={totals}
                    readOnly={!can.edit}
                    setField={setField}
                    setCategory={setCategory}
                    setItem={setItem}
                    addCategory={addCategory}
                    removeCategory={removeCategory}
                    addItem={addItem}
                    duplicateItem={duplicateItem}
                    removeItem={removeItem}
                />
            )}
            {activeTab === 'feltetelek' && (
                <ConditionsTab data={data} readOnly={!can.edit} setField={setField} />
            )}
            {activeTab === 'fizetes' && (
                <PaymentsTab data={data} totals={totals} readOnly={!can.edit} setField={setField} />
            )}
            {activeTab === 'ugyfel' && (
                <PreviewTab
                    quoteId={quote.id}
                    data={data}
                    totals={totals}
                    folders={folders}
                    setField={setField}
                />
            )}
        </>
    );
}

Editor.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
