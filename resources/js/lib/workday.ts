/**
 * Munkanap-segédek magyar munkaszüneti napokkal — a szerver
 * WorkdayCalendar szolgáltatásának kliensoldali párja (élő számításhoz).
 */

const holidayCache: Record<number, Record<string, string>> = {};

function ymd(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** Húsvétvasárnap (Gauss-algoritmus). */
function easter(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

export function holidays(year: number): Record<string, string> {
    if (holidayCache[year]) return holidayCache[year];
    const e = easter(year);
    const map: Record<string, string> = {
        [`${year}-01-01`]: 'Újév',
        [`${year}-03-15`]: 'Nemzeti ünnep',
        [ymd(addDays(e, -2))]: 'Nagypéntek',
        [ymd(addDays(e, 1))]: 'Húsvéthétfő',
        [`${year}-05-01`]: 'A munka ünnepe',
        [ymd(addDays(e, 50))]: 'Pünkösdhétfő',
        [`${year}-08-20`]: 'Államalapítás ünnepe',
        [`${year}-10-23`]: 'Nemzeti ünnep',
        [`${year}-11-01`]: 'Mindenszentek',
        [`${year}-12-25`]: 'Karácsony',
        [`${year}-12-26`]: 'Karácsony másnapja',
    };
    holidayCache[year] = map;
    return map;
}

function parse(value: string): Date {
    return new Date(`${value}T00:00:00`);
}

export function isWeekend(value: string): boolean {
    const day = parse(value).getDay();
    return day === 0 || day === 6;
}

export function holidayName(value: string): string | null {
    const d = parse(value);
    return holidays(d.getFullYear())[ymd(d)] ?? null;
}

export function isWorkday(value: string): boolean {
    return !isWeekend(value) && holidayName(value) === null;
}

/** Nem munkanap-e (hétvége vagy ünnep) — figyelmeztetéshez. */
export function nonWorkdayLabel(value: string): string | null {
    if (!value) return null;
    const hol = holidayName(value);
    if (hol) return hol;
    if (isWeekend(value)) return 'hétvége';
    return null;
}

function isWork(d: Date): boolean {
    const day = d.getDay();
    if (day === 0 || day === 6) return false;
    return holidays(d.getFullYear())[ymd(d)] === undefined;
}

/** Munkanapok száma két dátum között, mindkét végpontot beleértve. */
export function workdaysBetween(startStr: string, endStr: string): number {
    if (!startStr || !endStr) return 0;
    const start = parse(startStr);
    const end = parse(endStr);
    if (end < start) return 0;
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        if (isWork(cursor)) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

function nextWorkday(d: Date): Date {
    const cursor = new Date(d);
    while (!isWork(cursor)) cursor.setDate(cursor.getDate() + 1);
    return cursor;
}

/** A `workDays` hosszú, `startStr` napon kezdődő szakasz utolsó munkanapja. */
export function endFromStart(startStr: string, workDays: number): string {
    if (!startStr || workDays < 1) return '';
    let cursor = nextWorkday(parse(startStr));
    let counted = 1;
    while (counted < workDays) {
        cursor.setDate(cursor.getDate() + 1);
        cursor = nextWorkday(cursor);
        counted++;
    }
    return ymd(cursor);
}
