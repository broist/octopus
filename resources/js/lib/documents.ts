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

export function fileIcon(mime?: string | null, filename?: string | null): LucideIcon {
    const m = mime ?? '';
    if (m.startsWith('image/')) return FileImage;
    if (m === 'application/pdf') return FileText;
    if (m.includes('zip') || m.includes('compressed')) return FileArchive;

    const ext = (filename ?? '').split('.').pop()?.toLowerCase();
    if (ext && ['dwg', 'dxf', 'ifc', 'skp'].includes(ext)) return FileCode2;

    return File;
}
