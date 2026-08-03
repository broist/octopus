/**
 * Képek kicsinyítése és újratömörítése MÉG A FELTÖLTÉS ELŐTT, a böngészőben.
 *
 * Egy mai telefon fotója 4–12 MB. Építkezésen, mobilhálózaton ez fájlonként
 * tíz-húsz másodperc, egy tíz fotós napi jelentés pedig percek — ez volt a
 * „nagy képek feltöltése nagyon nehézkes” panasz oka. Egy 2560 képpontos,
 * 82%-os minőségű változat vizuálisan ugyanaz dokumentációs célra, de
 * jellemzően a méret 5–15%-a.
 *
 * A feldolgozás mindig SORBAN megy (egyszerre egy kép), mert egy 12 MP-es
 * bitkép ~48 MB memória — több párhuzamosan futó kicsinyítés a telefon
 * böngészőjét elfogyasztaná.
 */

/** Kicsinyítés utáni leghosszabb él képpontban. */
export const DEFAULT_MAX_EDGE = 2560;

/** JPEG/WebP minőség (0–1). */
export const DEFAULT_QUALITY = 0.82;

/** Ez alatt nem nyúlunk a fájlhoz — nincs mit nyerni rajta. */
const SKIP_BELOW_BYTES = 600 * 1024;

/** Ezekből a formátumokból tudunk kisebbet készíteni. */
const SHRINKABLE = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export interface ShrinkOptions {
    /** Leghosszabb él képpontban (alap: 2560). */
    maxEdge?: number;
    /** Tömörítési minőség 0–1 (alap: 0,82). */
    quality?: number;
}

export interface ShrinkResult {
    /** A feltöltendő fájlok — a kicsinyítettek, illetve érintetlen eredetik. */
    files: File[];
    /** Hány fájlt sikerült kisebbre hozni. */
    changed: number;
    /** Eredeti összméret (bájt). */
    beforeBytes: number;
    /** Feltöltendő összméret (bájt). */
    afterBytes: number;
}

/**
 * Érdemes-e egyáltalán megpróbálni? Az animált GIF és az SVG kimarad (az
 * elsőnél elveszne az animáció, a másodiknál vektor marad a jobb választás).
 */
export function isShrinkable(file: File): boolean {
    return SHRINKABLE.includes(file.type.toLowerCase()) && file.size > SKIP_BELOW_BYTES;
}

/** Van-e egyáltalán olyan fájl a listában, amin nyerhetünk? */
export const hasShrinkable = (files: File[]): boolean => files.some(isShrinkable);

/* ------------------------------------------------------------------ */
/* Kimeneti formátum                                                    */
/* ------------------------------------------------------------------ */

let webpSupport: boolean | null = null;

/** Tud-e a böngésző WebP-t KÓDOLNI? (A dekódolást régebbi is tudja.) */
function canEncodeWebp(): boolean {
    if (webpSupport !== null) return webpSupport;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
        webpSupport = false;
    }

    return webpSupport;
}

/**
 * A kimeneti típus. A JPEG marad JPEG (mindenhol nyílik), minden más — ha a
 * böngésző tudja — WebP lesz, mert az átlátszóságot is megtartja és kisebb.
 */
function outputType(file: File): string {
    const type = file.type.toLowerCase();

    if (type === 'image/jpeg' || type === 'image/pjpeg') return 'image/jpeg';

    return canEncodeWebp() ? 'image/webp' : 'image/jpeg';
}

/** Fájlnév a kimeneti formátumhoz igazított kiterjesztéssel. */
function renameTo(name: string, mime: string): string {
    const ext = mime === 'image/webp' ? 'webp' : 'jpg';
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;

    return `${stem}.${ext}`;
}

/* ------------------------------------------------------------------ */
/* Dekódolás                                                            */
/* ------------------------------------------------------------------ */

interface Decoded {
    source: CanvasImageSource;
    width: number;
    height: number;
    release: () => void;
}

/**
 * A kép beolvasása. A `createImageBitmap` az `imageOrientation: 'from-image'`
 * beállítással MAGA rendezi az EXIF-forgatást — enélkül az álló telefonfotók
 * az oldalukra fordulva kerülnének fel.
 */
async function decode(file: File): Promise<Decoded | null> {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

            return {
                source: bitmap,
                width: bitmap.width,
                height: bitmap.height,
                release: () => bitmap.close(),
            };
        } catch {
            /* megyünk a tartalék útra */
        }
    }

    // Tartalék: <img> + objektum-URL. A modern böngészők itt is figyelembe
    // veszik az EXIF-forgatást (image-orientation: from-image az alapértelmezés).
    const url = URL.createObjectURL(file);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('nem dekódolható'));
            el.src = url;
        });

        return {
            source: image,
            width: image.naturalWidth,
            height: image.naturalHeight,
            release: () => URL.revokeObjectURL(url),
        };
    } catch {
        URL.revokeObjectURL(url);

        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Kicsinyítés                                                          */
/* ------------------------------------------------------------------ */

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Egyetlen kép kicsinyítése. Hiba vagy nyereség nélküli eredmény esetén az
 * EREDETI fájllal tér vissza — a feltöltés soha nem hiúsulhat meg attól, hogy
 * a tömörítés nem sikerült.
 */
export async function shrinkImage(file: File, options: ShrinkOptions = {}): Promise<File> {
    const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
    const quality = options.quality ?? DEFAULT_QUALITY;

    if (!isShrinkable(file)) return file;

    const decoded = await decode(file);

    if (!decoded || decoded.width < 1 || decoded.height < 1) return file;

    try {
        const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));

        let width = decoded.width;
        let height = decoded.height;
        let canvas: HTMLCanvasElement | null = null;
        let source = decoded.source;

        // Erős kicsinyítésnél lépcsőzetesen felezünk: egyetlen nagy ugrásban a
        // böngésző szűrője szemcsés, „recés” képet adna.
        let targetWidth = Math.max(1, Math.round(decoded.width * scale));
        let targetHeight = Math.max(1, Math.round(decoded.height * scale));

        for (;;) {
            const nextWidth = Math.max(targetWidth, Math.round(width / 2));
            const nextHeight = Math.max(targetHeight, Math.round(height / 2));
            const last = nextWidth <= targetWidth && nextHeight <= targetHeight;

            const step = document.createElement('canvas');
            step.width = last ? targetWidth : nextWidth;
            step.height = last ? targetHeight : nextHeight;

            const ctx = step.getContext('2d');
            if (!ctx) return file;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // A JPEG nem tud átlátszóságot — fehérre lapítjuk, különben a
            // félig átlátszó részek feketén jelennének meg.
            if (outputType(file) === 'image/jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, step.width, step.height);
            }

            ctx.drawImage(source, 0, 0, step.width, step.height);

            if (canvas) canvas.width = canvas.height = 0; // az előző lépés elengedése
            canvas = step;
            source = step;
            width = step.width;
            height = step.height;

            if (last) break;
        }

        if (!canvas) return file;

        const type = outputType(file);
        const blob = await toBlob(canvas, type, quality);

        canvas.width = canvas.height = 0;

        if (!blob || blob.size === 0) return file;

        // Ha a böngésző nem ismerte a kért formátumot, PNG-t ad vissza — az
        // rendszerint NAGYOBB. A méret-ellenőrzés ezt is elkapja.
        if (blob.size >= file.size) return file;

        return new File([blob], renameTo(file.name, blob.type || type), {
            type: blob.type || type,
            lastModified: file.lastModified,
        });
    } catch {
        return file;
    } finally {
        decoded.release();
    }
}

/**
 * Több kép kicsinyítése egymás után, haladásjelzéssel.
 *
 * A ciklus minden kép után visszaadja a vezérlést a böngészőnek, hogy a
 * felület ne fagyjon be egy nagyobb adag feldolgozása közben.
 */
export async function shrinkImages(
    files: File[],
    options: ShrinkOptions = {},
    onProgress?: (done: number, total: number) => void,
): Promise<ShrinkResult> {
    const out: File[] = [];
    let changed = 0;
    let beforeBytes = 0;
    let afterBytes = 0;

    for (let i = 0; i < files.length; i++) {
        const original = files[i];
        const result = await shrinkImage(original, options);

        beforeBytes += original.size;
        afterBytes += result.size;
        if (result !== original) changed++;
        out.push(result);

        onProgress?.(i + 1, files.length);

        // Egy „levegővétel” a fő szálnak két kép között.
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return { files: out, changed, beforeBytes, afterBytes };
}
