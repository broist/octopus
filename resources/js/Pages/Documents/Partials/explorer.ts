import type { ExplorerFileRow, ExplorerFolderRow } from '@/types/models';

/* ------------------------------------------------------------------ */
/* Elem-modell                                                          */
/* ------------------------------------------------------------------ */

export type ExplorerItem =
    | { type: 'folder'; row: ExplorerFolderRow }
    | { type: 'file'; row: ExplorerFileRow };

/** Kijelölés-kulcs (mappa: `f-12`, fájl: `d-34`). */
export type ItemKey = string;

export const keyOf = (item: ExplorerItem): ItemKey =>
    `${item.type === 'folder' ? 'f' : 'd'}-${item.row.id}`;

export const nameOf = (item: ExplorerItem): string =>
    item.type === 'folder' ? item.row.name : item.row.title;

export const sizeOf = (item: ExplorerItem): number =>
    item.type === 'folder' ? 0 : item.row.size_bytes;

/** A kulcsból visszafejtett hivatkozás (tömeges műveletek payloadjához). */
export const refOf = (item: ExplorerItem) => ({ type: item.type, id: item.row.id });

/* ------------------------------------------------------------------ */
/* Nézetek                                                              */
/* ------------------------------------------------------------------ */

export type ViewMode = 'xl' | 'large' | 'medium' | 'list' | 'details' | 'tiles';

export const VIEW_LABELS: Record<ViewMode, string> = {
    xl: 'Nagyon nagy ikonok',
    large: 'Nagy ikonok',
    medium: 'Közepes ikonok',
    list: 'Lista',
    details: 'Részletek',
    tiles: 'Csempék',
};

/** Ikonméret nézetenként (rács-nézetekben). */
export const ICON_SIZE: Record<ViewMode, number> = {
    xl: 84,
    large: 60,
    medium: 44,
    tiles: 34,
    list: 17,
    details: 17,
};

/** Régi (v1) beállítások átfordítása az új nézetnevekre. */
export function normalizeView(value: string | null): ViewMode {
    if (value === 'grid') return 'medium';
    if (value && value in VIEW_LABELS) return value as ViewMode;
    return 'medium';
}

/* ------------------------------------------------------------------ */
/* Rendezés                                                             */
/* ------------------------------------------------------------------ */

export type SortKey = 'name' | 'updated' | 'type' | 'size';
export type SortDir = 'asc' | 'desc';
export interface SortState {
    key: SortKey;
    dir: SortDir;
}

export const SORT_LABELS: Record<SortKey, string> = {
    name: 'Név',
    updated: 'Módosítás dátuma',
    type: 'Típus',
    size: 'Méret',
};

const collator = new Intl.Collator('hu', { numeric: true, sensitivity: 'base' });

/**
 * Az Intézőhöz hasonlóan a mappák mindig a fájlok előtt állnak, a rendezés
 * ezen belül érvényesül.
 */
export function sortItems(items: ExplorerItem[], sort: SortState): ExplorerItem[] {
    const sign = sort.dir === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;

        let cmp = 0;
        switch (sort.key) {
            case 'updated':
                cmp = a.row.updated_at.localeCompare(b.row.updated_at);
                break;
            case 'size':
                cmp = sizeOf(a) - sizeOf(b);
                break;
            case 'type':
                cmp = collator.compare(kindLabel(a), kindLabel(b));
                break;
            default:
                cmp = 0;
        }

        if (cmp === 0) cmp = collator.compare(nameOf(a), nameOf(b));

        return cmp * sign;
    });
}

/* ------------------------------------------------------------------ */
/* Fájltípus-megnevezések (Intéző „Típus” oszlop)                       */
/* ------------------------------------------------------------------ */

const KIND_BY_EXT: Record<string, string> = {
    pdf: 'PDF-dokumentum',
    doc: 'Word-dokumentum',
    docx: 'Word-dokumentum',
    odt: 'Szövegdokumentum',
    xls: 'Excel-munkafüzet',
    xlsx: 'Excel-munkafüzet',
    csv: 'CSV-fájl',
    ppt: 'PowerPoint-bemutató',
    pptx: 'PowerPoint-bemutató',
    txt: 'Szöveges dokumentum',
    rtf: 'Szövegdokumentum',
    zip: 'Tömörített mappa',
    rar: 'Tömörített mappa',
    '7z': 'Tömörített mappa',
    jpg: 'JPEG-kép',
    jpeg: 'JPEG-kép',
    png: 'PNG-kép',
    gif: 'GIF-kép',
    webp: 'WebP-kép',
    heic: 'HEIC-kép',
    bmp: 'Bitkép',
    svg: 'SVG-kép',
    tif: 'TIFF-kép',
    tiff: 'TIFF-kép',
    dwg: 'AutoCAD-rajz',
    dxf: 'DXF-rajz',
    ifc: 'IFC-modell',
    skp: 'SketchUp-modell',
    mp4: 'Videofájl',
    mov: 'Videofájl',
    avi: 'Videofájl',
    mp3: 'Hangfájl',
    wav: 'Hangfájl',
};

export function extensionOf(filename?: string | null): string {
    const name = filename ?? '';
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function fileKind(mime?: string | null, filename?: string | null): string {
    const ext = extensionOf(filename);
    if (ext && KIND_BY_EXT[ext]) return KIND_BY_EXT[ext];
    if (ext) return `${ext.toUpperCase()}-fájl`;

    const m = mime ?? '';
    if (m.startsWith('image/')) return 'Kép';
    if (m.startsWith('video/')) return 'Videofájl';
    if (m.startsWith('audio/')) return 'Hangfájl';

    return 'Fájl';
}

export function kindLabel(item: ExplorerItem): string {
    return item.type === 'folder'
        ? 'Mappa'
        : fileKind(item.row.mime_type, item.row.original_filename);
}

/* ------------------------------------------------------------------ */
/* Vágólap + előzmények (munkamenetben megőrizve)                       */
/* ------------------------------------------------------------------ */

export interface ClipboardState {
    mode: 'copy' | 'cut';
    items: { type: 'folder' | 'file'; id: number }[];
    keys: ItemKey[];
    label: string;
}

const CLIPBOARD_KEY = 'octopus.files.clipboard';

export function readClipboard(): ClipboardState | null {
    try {
        const raw = sessionStorage.getItem(CLIPBOARD_KEY);
        return raw ? (JSON.parse(raw) as ClipboardState) : null;
    } catch {
        return null;
    }
}

export function writeClipboard(state: ClipboardState | null): void {
    try {
        if (state) sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(state));
        else sessionStorage.removeItem(CLIPBOARD_KEY);
    } catch {
        /* privát mód – a vágólap ilyenkor csak az oldal élettartamáig él */
    }
}

export interface NavState {
    stack: (number | null)[];
    idx: number;
    /** Vissza/Előre navigáció zajlik – az érkező oldal ne toldja meg a vermet. */
    pending: boolean;
}

const NAV_KEY = 'octopus.files.nav';

export function readNav(): NavState {
    try {
        const raw = sessionStorage.getItem(NAV_KEY);
        if (raw) return JSON.parse(raw) as NavState;
    } catch {
        /* nem baj, üresről indulunk */
    }
    return { stack: [], idx: -1, pending: false };
}

export function writeNav(state: NavState): void {
    try {
        sessionStorage.setItem(NAV_KEY, JSON.stringify(state));
    } catch {
        /* privát mód */
    }
}

/* ------------------------------------------------------------------ */
/* Egyéb                                                                */
/* ------------------------------------------------------------------ */

/** Fájlnév törzse (átnevezéskor a kiterjesztés nélküli részt jelöljük ki). */
export function baseName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

/** Két téglalap metszi-e egymást (gumikeretes kijelöléshez). */
export function intersects(a: DOMRect, b: DOMRect): boolean {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}
