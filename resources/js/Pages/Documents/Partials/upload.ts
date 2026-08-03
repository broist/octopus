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

/** Elérhető-e a natív mappaválasztó (File System Access API)? */
export const canPickDirectory = (): boolean =>
    typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

export type DirectoryPick =
    | { status: 'ok'; entries: UploadEntry[] }
    | { status: 'cancelled' }
    | { status: 'unavailable' };

/**
 * Mappa választása a natív mappaválasztóval, a teljes tartalom bejárásával.
 *
 * Ez megbízhatóbb a `webkitdirectory` bemenetnél: ott a böngésző a relatív
 * útvonalat (`webkitRelativePath`) néha üresen adja vissza, és akkor a
 * mappaszerkezet menthetetlenül elveszik.
 */
export async function entriesFromDirectoryPicker(): Promise<DirectoryPick> {
    const picker = (window as { showDirectoryPicker?: () => Promise<HandleLike> })
        .showDirectoryPicker;

    if (typeof picker !== 'function') return { status: 'unavailable' };

    let handle: HandleLike;
    try {
        handle = await picker.call(window);
    } catch (err) {
        // Megszakítás = AbortError; minden más hibánál maradjon a régi út.
        return (err as DOMException)?.name === 'AbortError'
            ? { status: 'cancelled' }
            : { status: 'unavailable' };
    }

    const out: UploadEntry[] = [];
    await walkHandle(handle, '', out);

    return { status: 'ok', entries: out };
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

/** Egyszerre futó feltöltő kérések száma. */
const CONCURRENCY = 2;

/** Hálózati hiba / 5xx esetén ennyiszer próbáljuk újra a szakaszt. */
const RETRIES = 2;

/** Egy kérésbe kerülő fájlok — a listabeli SORSZÁMAIKKAL azonosítva. */
export interface Batch {
    indices: number[];
    bytes: number;
}

/**
 * A feltöltés több kérésre bontása darabszám és méret szerint. Egy önmagában
 * nagy fájl külön kérésbe kerül.
 */
export function buildBatches(entries: UploadEntry[]): Batch[] {
    const batches: Batch[] = [];
    let current: Batch = { indices: [], bytes: 0 };

    entries.forEach((entry, index) => {
        const size = entry.file.size;
        const full = current.indices.length >= BATCH_FILES || current.bytes + size > BATCH_BYTES;

        if (current.indices.length > 0 && full) {
            batches.push(current);
            current = { indices: [], bytes: 0 };
        }

        current.indices.push(index);
        current.bytes += size;
    });

    if (current.indices.length > 0) batches.push(current);

    return batches;
}

/* ------------------------------------------------------------------ */
/* Küldés                                                               */
/* ------------------------------------------------------------------ */

export interface UploadRequest {
    entries: UploadEntry[];
    /** Sorszám szerint illeszkedő megjelenítendő nevek ('' = maradjon az eredeti). */
    names: string[];
    folderId: number | null;
    category: string;
    projectId: number | '';
}

export interface UploadOutcome {
    uploaded: number;
    folders: number;
    failures: string[];
}

/** A szerver hibaüzenete olvasható formában. */
export function uploadErrorText(err: unknown): string {
    const res = (
        err as {
            response?: {
                status?: number;
                data?: { message?: string; errors?: Record<string, string[]> };
            };
        }
    ).response;

    if (!res) return 'a feltöltés megszakadt (hálózati hiba)';
    if (res.status === 413) return 'a csomag túl nagy a kiszolgálónak';
    if (res.status === 403) return 'nincs jogosultsága ide feltölteni';
    if (res.status === 419) return 'lejárt a munkamenet, jelentkezzen be újra';

    const first = Object.values(res.data?.errors ?? {})[0]?.[0];

    return first ?? res.data?.message ?? `hiba (${res.status ?? '?'})`;
}

/** Érdemes-e újrapróbálni? Hálózati hiba és kiszolgálóhiba igen, 4xx nem. */
function retryable(err: unknown): boolean {
    const status = (err as { response?: { status?: number } }).response?.status;

    return status === undefined || status >= 500;
}

/**
 * A szakaszok elküldése korlátozott párhuzamossággal.
 *
 * Mobilhálózaton a több párhuzamos kapcsolat érezhetően jobban kihasználja a
 * feltöltési sávszélességet, mint az egyesével küldés — de kettőnél többől már
 * nincs nyereség, csak késleltetés és memóriahasználat.
 */
export async function runUpload(
    request: UploadRequest,
    onProgress: (loadedBytes: number, doneFiles: number) => void,
): Promise<UploadOutcome> {
    const batches = buildBatches(request.entries);
    const loaded = new Array<number>(batches.length).fill(0);
    const failures: string[] = [];

    let uploaded = 0;
    let folders = 0;
    let doneFiles = 0;

    const report = () =>
        onProgress(
            loaded.reduce((sum, n) => sum + n, 0),
            doneFiles,
        );

    const send = async (batch: Batch, slot: number): Promise<void> => {
        for (let attempt = 0; ; attempt++) {
            const form = new FormData();

            for (const index of batch.indices) {
                const entry = request.entries[index];
                form.append('files[]', entry.file);
                form.append('paths[]', entry.path);
                form.append('names[]', request.names[index] ?? '');
            }

            if (request.folderId !== null) form.append('folder_id', String(request.folderId));
            if (request.category) form.append('category', request.category);
            if (request.projectId !== '') form.append('project_id', String(request.projectId));

            try {
                const { data } = await window.axios.post(route('documents.store'), form, {
                    onUploadProgress: (event: { loaded?: number }) => {
                        loaded[slot] = Math.min(batch.bytes, event.loaded ?? 0);
                        report();
                    },
                });

                uploaded += (data?.uploaded as number) ?? batch.indices.length;
                folders += (data?.folders_created as number) ?? 0;
                loaded[slot] = batch.bytes;
                doneFiles += batch.indices.length;
                report();

                return;
            } catch (err) {
                if (attempt < RETRIES && retryable(err)) {
                    // Újrapróbálás előtt visszavesszük a félbemaradt haladást,
                    // hogy a csík ne ugorjon vissza-előre.
                    loaded[slot] = 0;
                    report();
                    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));

                    continue;
                }

                failures.push(
                    `${batch.indices.length} fájl kimaradt — ${uploadErrorText(err)}.`,
                );
                loaded[slot] = batch.bytes;
                doneFiles += batch.indices.length;
                report();

                return;
            }
        }
    };

    let next = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
        for (;;) {
            const slot = next++;
            if (slot >= batches.length) return;
            await send(batches[slot], slot);
        }
    });

    await Promise.all(workers);

    return { uploaded, folders, failures };
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
