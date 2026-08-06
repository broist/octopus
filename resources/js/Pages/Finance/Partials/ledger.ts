/**
 * Közös segédek a Tagi kölcsön nézetekhez.
 *
 * A forint egész számként jelenik meg (nincs fillér), a deviza két tizedessel.
 */

export const SYMBOLS: Record<string, string> = {
    HUF: 'Ft',
    EUR: '€',
    USD: '$',
};

const intFmt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function fmtMoney(value: number, currency = 'HUF'): string {
    const symbol = SYMBOLS[currency] ?? currency;
    const formatted = currency === 'HUF' ? intFmt.format(Math.round(value)) : decFmt.format(value);

    return `${formatted} ${symbol}`;
}

export function fmtHuf(value: number): string {
    return `${intFmt.format(Math.round(value))} Ft`;
}

/** `2026-06-01` → `2026-06` (a hónap-választó bemenetéhez). */
export function toMonthInput(value: string | null): string {
    return value ? value.slice(0, 7) : '';
}

/** `2026-06` → `2026-06-01` (a szerver dátumot vár). */
export function fromMonthInput(value: string): string | null {
    return value ? `${value}-01` : null;
}

export function today(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface ShareInput {
    member_id: number;
    name: string;
    percent: string;
    checked: boolean;
}

/**
 * A felosztás-szerkesztő kiinduló sorai: minden tag egy sor, alapból a saját
 * alapértelmezett részesedésével. Meglévő tételnél a rögzített arányok nyernek.
 */
export function shareRows(
    members: { id: number; name: string; default_share: number; is_active?: boolean }[],
    existing?: { member_id: number; percent: number }[] | null,
): ShareInput[] {
    const byMember = new Map((existing ?? []).map((s) => [s.member_id, s.percent]));

    return members
        // Inaktív tag csak akkor jelenik meg, ha van benne rögzített arány.
        .filter((m) => m.is_active !== false || byMember.has(m.id))
        .map((m) => {
            const set = byMember.has(m.id);

            return {
                member_id: m.id,
                name: m.name,
                percent: String(set ? byMember.get(m.id) : m.default_share),
                checked: existing ? set : m.default_share > 0,
            };
        });
}

/** Egy tag részesedése a szerver felé küldött alakban. */
export interface SharePayload {
    member_id: number;
    percent: number;
}

/**
 * A kiválasztott tagok százalékai a szerver felé (csak a bejelöltek mennek).
 */
export function sharePayload(rows: ShareInput[]): SharePayload[] {
    return rows
        .filter((r) => r.checked)
        .map((r) => ({ member_id: r.member_id, percent: Number(r.percent) || 0 }));
}
