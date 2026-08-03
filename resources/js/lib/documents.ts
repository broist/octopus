import { FileImage, FileText, FileArchive, FileCode2, File, type LucideIcon } from 'lucide-react';

/** Dokumentum-kategóriák (a backend Document::CATEGORIES tükre). */
export const CATEGORY_LABELS: Record<string, string> = {
    terv: 'Tervrajz',
    engedely: 'Engedély',
    szerzodes: 'Szerződés',
    teljesitesigazolas: 'Teljesítésigazolás',
    foto: 'Fotó',
    egyeb: 'Egyéb',
};

/** Szerveroldalon előállított bélyegkép-méretek (App\Services\Thumbnails::SIZES). */
const THUMB_SIZES = [160, 400, 1200];

/**
 * A megjelenített mérethez illő bélyegkép-URL.
 *
 * Sűrű kijelzőn (retina, a legtöbb telefon) kétszeres képpontsűrűséggel
 * számolunk, hogy a kép ne legyen szemcsés, de továbbra is töredéke legyen az
 * eredetinek.
 */
export function thumbUrl(versionId: number, displayPx: number): string {
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const needed = displayPx * dpr;
    const size = THUMB_SIZES.find((s) => s >= needed) ?? THUMB_SIZES[THUMB_SIZES.length - 1];

    return route('documents.versions.thumb', { version: versionId, size });
}

export function fileIcon(mime?: string | null, filename?: string | null): LucideIcon {
    const m = mime ?? '';
    if (m.startsWith('image/')) return FileImage;
    if (m === 'application/pdf') return FileText;
    if (m.includes('zip') || m.includes('compressed')) return FileArchive;

    const ext = (filename ?? '').split('.').pop()?.toLowerCase();
    if (ext && ['dwg', 'dxf', 'ifc', 'skp'].includes(ext)) return FileCode2;

    return File;
}
