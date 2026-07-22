import type {
    ProfitMode,
    QuoteCategory,
    QuoteData,
    QuoteItem,
} from '@/types/quote';

/** Fél-fel kerekítés egész HUF-ra (a szerver PHP kalkulátorával azonos). */
function eround(value: number): number {
    return Math.sign(value) * Math.round(Math.abs(value));
}

function num(value: unknown, def = 0): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(n) ? n : def;
}

export function effectiveProfit(
    quote: QuoteData,
    category: QuoteCategory,
    item: QuoteItem,
): { mode: ProfitMode; value: number } {
    if (item.profitOverride) {
        return { mode: item.profitMode ?? 'markup', value: num(item.profitValue) };
    }
    if (category.profitOverride) {
        return { mode: category.profitMode ?? 'markup', value: num(category.profitValue) };
    }
    return { mode: quote.globalProfitMode ?? 'markup', value: num(quote.globalProfitValue) };
}

export interface ItemCalc {
    quantity: number;
    ownCost: number;
    subCost: number;
    base: number;
    offer: number;
    profit: number;
    margin: number;
    markup: number;
}

export function calcItem(quote: QuoteData, category: QuoteCategory, item: QuoteItem): ItemCalc {
    const qty = num(item.quantity);
    const ownCost = eround(qty * num(item.ownMaterialUnit)) + eround(qty * num(item.ownLaborUnit));
    const subCost = eround(qty * num(item.subMaterialUnit)) + eround(qty * num(item.subLaborUnit));

    const base =
        item.basis === 'sub'
            ? subCost
            : item.basis === 'manual'
              ? eround(num(item.manualBase))
              : ownCost;

    const { mode, value } = effectiveProfit(quote, category, item);
    const offer =
        mode === 'multiplier'
            ? eround(base * value)
            : mode === 'fixed'
              ? eround(value)
              : eround(base * (1 + value / 100));

    const profit = offer - base;
    return {
        quantity: qty,
        ownCost,
        subCost,
        base,
        offer,
        profit,
        margin: offer ? (profit / offer) * 100 : 0,
        markup: base ? (profit / base) * 100 : 0,
    };
}

export interface CategoryCalc {
    base: number;
    offer: number;
    profit: number;
}

export function calcCategory(quote: QuoteData, category: QuoteCategory): CategoryCalc {
    let base = 0;
    let offer = 0;
    let profit = 0;
    for (const item of category.items ?? []) {
        if (!item.active) continue;
        const c = calcItem(quote, category, item);
        base += c.base;
        offer += c.offer;
        profit += c.profit;
    }
    return { base, offer, profit };
}

export interface ProjectCalc {
    ownMaterial: number;
    ownLabor: number;
    subCost: number;
    baseCost: number;
    itemOffer: number;
    netOffer: number;
    vat: number;
    grossOffer: number;
    profit: number;
    margin: number;
    markup: number;
}

export function calcProject(quote: QuoteData): ProjectCalc {
    let baseCost = 0;
    let itemOffer = 0;
    let subCost = 0;
    let ownMaterial = 0;
    let ownLabor = 0;

    for (const category of quote.categories ?? []) {
        if (!category.active) continue;
        for (const item of category.items ?? []) {
            if (!item.active) continue;
            const qty = num(item.quantity);
            ownMaterial += eround(qty * num(item.ownMaterialUnit));
            ownLabor += eround(qty * num(item.ownLaborUnit));
            const c = calcItem(quote, category, item);
            subCost += c.subCost;
            baseCost += c.base;
            itemOffer += c.offer;
        }
    }

    const discount = eround(num(quote.discount));
    const contingency = eround(num(quote.contingency));
    const projectCost = eround(num(quote.projectCost));
    const rounding = eround(num(quote.rounding));
    const netOffer = eround(itemOffer - discount + contingency + projectCost + rounding);
    const vat = eround((netOffer * num(quote.vatRate)) / 100);
    const grossOffer = netOffer + vat;
    const profit = netOffer - baseCost;

    return {
        ownMaterial,
        ownLabor,
        subCost,
        baseCost,
        itemOffer,
        netOffer,
        vat,
        grossOffer,
        profit,
        margin: netOffer ? (profit / netOffer) * 100 : 0,
        markup: baseCost ? (profit / baseCost) * 100 : 0,
    };
}

export function fmtHuf(value: number): string {
    return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(Math.round(value || 0)) + ' Ft';
}

export function fmtPercent(value: number): string {
    return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(value || 0) + '%';
}
