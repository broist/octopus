/**
 * Feltöltés-segédek: mappák (almappákkal) begyűjtése fájlválasztóból és
 * húzás–ejtésből, valamint a nagy feltöltés szakaszokra bontása.
 */

/** Egy feltöltendő fájl a célmappán belüli relatív mappa-útvonalával. */
export interface UploadEntry {
    file: File;
    /** Relatív mappa-útvonal fájlnév nélkül; '' = közvetlenül a célmappába. */
    path: string;
}

/** Legnagyobb fájlméret (a szerver oldali 120 MB-os korláttal egyezően). */
export const MAX_FILE_BYTES = 120 * 1024 * 1024;

/** Egy kérésben küldött fájlok száma (a PHP max_file_uploads=20 alatt marad). */
const BATCH_FILES = 15;

/** Egy kérés hasznos terhe (a post_max_size=140M alatt marad). */
const BATCH_BYTES = 80 * 1024 * 1024;

/** Egy feltöltésben kezelt fájlok felső korlátja (böngésző-védelem). */
export const MAX_ENTRIES = 2000;

/** A fájl relatív mappa-útvonala mappaválasztó esetén (webkitRelativePath). */
function relativeDir(file: File): string {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
    if (!rel) return '';

    const parts = rel.split('/');
    parts.pop(); // a fájlnév nem része az útvonalnak

    return parts.join('/');
}

/** Fájlválasztóból (fájl vagy mappa) érkező lista átalakítása. */
export function entriesFromFiles(list: FileList | File[] | null): UploadEntry[] {
    if (!list) return [];

    return Array.from(list)
        .slice(0, MAX_ENTRIES)
        .map((file) => ({ file, path: relativeDir(file) }));
}

/* ------------------------------------------------------------------ */
/* Húzás–ejtés: az operációs rendszerből behúzott mappa bejárása        */
/* ------------------------------------------------------------------ */

function readFile(entry: FileSystemFileEntry): Promise<File | null> {
    return new Promise((resolve) => {
        entry.file(
            (file) => resolve(file),
            () => resolve(null),
        );
    });
}

/** A könyvtár-olvasó hívásonként legfeljebb 100 elemet ad — üresig kell hívni. */
function readDir(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    return new Promise((resolve) => {
        reader.readEntries(
            (entries) => resolve(entries),
            () => resolve([]),
        );
    });
}

async function walk(entry: FileSystemEntry, prefix: string, out: UploadEntry[]): Promise<void> {
    if (out.length >= MAX_ENTRIES) return;

    // Egyetlen olvashatatlan elem (jogosultság, felhőben tárolt OneDrive-fájl,
    // böngésző-hiba) ne vigye magával az egész mappát.
    try {
        if (entry.isFile) {
            const file = await readFile(entry as FileSystemFileEntry);
            if (file) out.push({ file, path: prefix });

            return;
        }

        if (!entry.isDirectory) return;

        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        const reader = (entry as FileSystemDirectoryEntry).createReader();

        for (;;) {
            const batch = await readDir(reader);
            if (batch.length === 0) break;

            for (const child of batch) {
                await walk(child, path, out);
            }
        }
    } catch {
        /* ezt az ágat kihagyjuk, a többi mehet tovább */
    }
}

/* -------- újabb API: File System Access (getAsFileSystemHandle) --------- */

/** A böngésző mappa-leírója (a TS DOM-típusai közt még nem mindenhol van meg). */
interface HandleLike {
    kind: 'file' | 'directory';
    name: string;
    getFile?: () => Promise<File>;
    values?: () => AsyncIterableIterator<HandleLike>;
}

async function walkHandle(handle: HandleLike, prefix: string, out: UploadEntry[]): Promise<void> {
    if (out.length >= MAX_ENTRIES) return;

    try {
        if (handle.kind === 'file') {
            const file = await handle.getFile?.();
            if (file) out.push({ file, path: prefix });

            return;
        }

        const path = prefix ? `${prefix}/${handle.name}` : handle.name;
        const children = handle.values?.();
        if (!children) return;

        for await (const child of children) {
            await walkHandle(child, path, out);
        }
    } catch {
        /* ezt az ágat kihagyjuk, a többi mehet tovább */
    }
}

/**
 * Ejtett elemek begyűjtése. A mappákat előbb a régebbi webkitGetAsEntry, majd
 * — ha az nem hozott semmit — az újabb File System Access API-val járjuk be;
 * végül marad a lapos fájllista. Mindhárom forrás kiolvasása SZINKRON módon
 * történik (az első `await` ELŐTT), mert a DataTransfer az esemény után
 * érvénytelen.
 */
export async function entriesFromDrop(dt: DataTransfer): Promise<UploadEntry[]> {
    const roots: FileSystemEntry[] = [];
    const handles: Promise<HandleLike | null>[] = [];

    if (dt.items) {
        for (const item of Array.from(dt.items)) {
            // Nem szűrünk `kind`-ra: a webkitGetAsEntry úgyis null-t ad
            // mindenre, ami nem fájlrendszeri elem.
            const entry = item.webkitGetAsEntry?.() ?? null;
            if (entry) roots.push(entry);

            const asHandle = (item as DataTransferItem & {
                getAsFileSystemHandle?: () => Promise<HandleLike | null>;
            }).getAsFileSystemHandle;

            if (typeof asHandle === 'function') {
                handles.push(asHandle.call(item).catch(() => null));
            }
        }
    }

    // Tartalék a lapos fájllistából (régi böngésző, vagy ha a bejárás elhasal).
    const flat = entriesFromFiles(dt.files);

    const out: UploadEntry[] = [];

    for (const root of roots) {
        await walk(root, '', out);
    }

    if (out.length === 0 && handles.length > 0) {
        for (const handle of await Promise.all(handles)) {
            if (handle) await walkHandle(handle, '', out);
        }
    }

    return out.length > 0 ? out : flat;
}

/**
 * Mappának látszó „fájl”: az ejtett mappa a régi (bejárás nélküli) ágon 0
 * bájtos, típus és kiterjesztés nélküli fájlként érkezne — ezt jelezzük, nem
 * töltjük fel.
 */
export const looksLikeFolder = (file: File): boolean =>
    file.size === 0 && file.type === '' && ! /\.[^./\\]+$/.test(file.name);

/* ------------------------------------------------------------------ */
/* Szakaszolás                                                          */
/* ------------------------------------------------------------------ */

/**
 * A feltöltés több kérésre bontása darabszám és méret szerint. Egy önmagában
 * nagy fájl külön kérésbe kerül.
 */
export function buildBatches(entries: UploadEntry[]): UploadEntry[][] {
    const batches: UploadEntry[][] = [];
    let current: UploadEntry[] = [];
    let bytes = 0;

    for (const entry of entries) {
        const size = entry.file.size;
        const full = current.length >= BATCH_FILES || bytes + size > BATCH_BYTES;

        if (current.length > 0 && full) {
            batches.push(current);
            current = [];
            bytes = 0;
        }

        current.push(entry);
        bytes += size;
    }

    if (current.length > 0) batches.push(current);

    return batches;
}

/** Az érintett (újonnan létrejövő) mappa-útvonalak száma. */
export function folderCount(entries: UploadEntry[]): number {
    const paths = new Set<string>();

    for (const entry of entries) {
        const parts = entry.path.split('/').filter(Boolean);
        for (let i = 1; i <= parts.length; i++) {
            paths.add(parts.slice(0, i).join('/'));
        }
    }

    return paths.size;
}

export const totalBytes = (entries: UploadEntry[]): number =>
    entries.reduce((sum, e) => sum + e.file.size, 0);
