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
    /**
     * A tétel anyag-, illetve munkadíj-összára (mennyiség × egységár) a
     * választott alap (saját / alvállalkozói) szerint. Ez csak a `base`
     * MEGBONTÁSA megjelenítéshez — a két szám összege pontosan a költségalap.
     * Manuális alapnál nincs értelmezhető bontás, ezért null.
     */
    materialTotal: number | null;
    laborTotal: number | null;
    /**
     * Az ügyfélnek mutatott anyag/díj bontás — a HASZONNAL NÖVELT ajánlati áron.
     * Az ajánlati ár a költségalap anyag–munkadíj arányában oszlik ketté, a
     * maradék a díjra kerül, így a kettő összege pontosan `offer`.
     * Manuális alapnál a saját egységárak aránya a viszonyítás; ha az sincs,
     * a teljes összeg díj.
     */
    offerMaterial: number;
    offerLabor: number;
}

export function calcItem(quote: QuoteData, category: QuoteCategory, item: QuoteItem): ItemCalc {
    const qty = num(item.quantity);
    const ownMaterial = eround(qty * num(item.ownMaterialUnit));
    const ownLabor = eround(qty * num(item.ownLaborUnit));
    const subMaterial = eround(qty * num(item.subMaterialUnit));
    const subLabor = eround(qty * num(item.subLaborUnit));
    const ownCost = ownMaterial + ownLabor;
    const subCost = subMaterial + subLabor;

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

    const refMaterial = item.basis === 'sub' ? subMaterial : ownMaterial;
    const refLabor = item.basis === 'sub' ? subLabor : ownLabor;
    const reference = refMaterial + refLabor;
    const offerMaterial = reference !== 0 ? eround((offer * refMaterial) / reference) : 0;

    return {
        quantity: qty,
        ownCost,
        subCost,
        base,
        offer,
        profit,
        margin: offer ? (profit / offer) * 100 : 0,
        markup: base ? (profit / base) * 100 : 0,
        materialTotal: item.basis === 'manual' ? null : item.basis === 'sub' ? subMaterial : ownMaterial,
        laborTotal: item.basis === 'manual' ? null : item.basis === 'sub' ? subLabor : ownLabor,
        offerMaterial,
        offerLabor: offer - offerMaterial,
    };
}

export interface CategoryCalc {
    base: number;
    offer: number;
    offerMaterial: number;
    offerLabor: number;
    profit: number;
}

export function calcCategory(quote: QuoteData, category: QuoteCategory): CategoryCalc {
    let base = 0;
    let offer = 0;
    let offerMaterial = 0;
    let offerLabor = 0;
    let profit = 0;
    for (const item of category.items ?? []) {
        if (!item.active) continue;
        const c = calcItem(quote, category, item);
        base += c.base;
        offer += c.offer;
        offerMaterial += c.offerMaterial;
        offerLabor += c.offerLabor;
        profit += c.profit;
    }
    return { base, offer, offerMaterial, offerLabor, profit };
}

export interface ProjectCalc {
    ownMaterial: number;
    ownLabor: number;
    subCost: number;
    baseCost: number;
    itemOffer: number;
    offerMaterial: number;
    offerLabor: number;
    netOffer: number;
    /** A nettó végösszeg anyag-, illetve díjrésze (a kettő összege a netOffer). */
    netMaterial: number;
    netLabor: number;
    vat: number;
    grossOffer: number;
    profit: number;
    margin: number;
    markup: number;
}

export function calcProject(quote: QuoteData): ProjectCalc {
    let baseCost = 0;
    let itemOffer = 0;
    let offerMaterial = 0;
    let offerLabor = 0;
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
            offerMaterial += c.offerMaterial;
            offerLabor += c.offerLabor;
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

    // A projektszintű korrekciók (kedvezmény, tartalék, projektköltség,
    // kerekítés) a tételek anyag–díj arányában oszlanak szét; a maradék a díjra
    // kerül, hogy a két szám összege pontosan a nettó ajánlati összeg legyen.
    const netMaterial = itemOffer !== 0 ? eround((netOffer * offerMaterial) / itemOffer) : 0;

    return {
        ownMaterial,
        ownLabor,
        subCost,
        baseCost,
        itemOffer,
        offerMaterial,
        offerLabor,
        netOffer,
        netMaterial,
        netLabor: netOffer - netMaterial,
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
