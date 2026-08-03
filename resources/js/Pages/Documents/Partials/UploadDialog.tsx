import { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { AlertTriangle, CheckCircle2, FileUp, FolderTree, Sparkles, X } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import { fmtBytes } from '@/lib/format';
import { isShrinkable, shrinkImages } from '@/lib/image';
import {
    type UploadEntry,
    MAX_FILE_BYTES,
    folderCount,
    runUpload,
    totalBytes,
} from '@/Pages/Documents/Partials/upload';
import type { ProjectOption } from '@/types/models';

interface UploadDialogProps {
    open: boolean;
    entries: UploadEntry[];
    /** Magyarázat, ha a választásból nem jött össze feltölthető fájl. */
    notice?: string;
    folderId: number | null;
    categories: Record<string, string>;
    projects: ProjectOption[];
    onClose: () => void;
}

/** E fölött (vagy mappás feltöltésnél) nincs fájlonkénti átnevezés. */
const RENAME_LIMIT = 25;

/** Legfeljebb ennyi sort listázunk ki (nagy mappánál a DOM védelme). */
const LIST_LIMIT = 300;

/** A képtömörítés választása megjegyezhető. */
const COMPRESS_KEY = 'octopus.files.compress';

/** Fájlnév kiterjesztés nélkül (átnevezés alapértéke). */
function baseName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

function extOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot) : '';
}

/**
 * Feltöltés megerősítő: a kiválasztott fájlok/mappák listája, kevés fájlnál
 * fájlonként átnevezhető névvel, opcionális kategória- és projekt-kötéssel.
 *
 * A küldés szakaszokban megy (axiosszal, nem Inertiával), hogy egy sok fájlos
 * mappa is átférjen a PHP darabszám- és méretkorlátain; a párbeszéd közben
 * összesített haladást, végül eredmény-összegzést mutat.
 *
 * A képeket alapból MÉG A KÜLDÉS ELŐTT kicsinyítjük a böngészőben — egy
 * telefonfotó így tíz megabájt helyett néhány százból felmegy.
 */
export default function UploadDialog({
    open,
    entries: incoming,
    notice,
    folderId,
    categories,
    projects,
    onClose,
}: UploadDialogProps) {
    const [entries, setEntries] = useState<UploadEntry[]>([]);
    const [names, setNames] = useState<string[]>([]);
    const [oversized, setOversized] = useState<string[]>([]);
    const [category, setCategory] = useState('');
    const [projectId, setProjectId] = useState<number | ''>('');
    const [compress, setCompress] = useState(
        () => localStorage.getItem(COMPRESS_KEY) !== 'off',
    );

    const [phase, setPhase] = useState<'ready' | 'preparing' | 'uploading' | 'done'>('ready');
    const [prepared, setPrepared] = useState({ done: 0, total: 0 });
    const [sendBytes, setSendBytes] = useState(0);
    const [progress, setProgress] = useState({ files: 0, bytes: 0 });
    const [result, setResult] = useState<{
        uploaded: number;
        folders: number;
        savedBytes: number;
        failures: string[];
    } | null>(null);

    useEffect(
        () => localStorage.setItem(COMPRESS_KEY, compress ? 'on' : 'off'),
        [compress],
    );

    useEffect(() => {
        if (!open) return;

        // A túl nagy fájlokat előre kiszűrjük: a kiszolgáló amúgy is
        // visszautasítaná, és magával vinné a szakasz többi fájlját is.
        const ok = incoming.filter((e) => e.file.size <= MAX_FILE_BYTES);

        setEntries(ok);
        setNames(ok.map((e) => baseName(e.file.name)));
        setOversized(
            incoming.filter((e) => e.file.size > MAX_FILE_BYTES).map((e) => e.file.name),
        );
        setCategory('');
        setProjectId('');
        setPhase('ready');
        setPrepared({ done: 0, total: 0 });
        setSendBytes(0);
        setProgress({ files: 0, bytes: 0 });
        setResult(null);
    }, [open, incoming]);

    const folders = useMemo(() => folderCount(entries), [entries]);
    const bytes = useMemo(() => totalBytes(entries), [entries]);
    const structured = folders > 0 || entries.length > RENAME_LIMIT;

    /** Hány képen nyerhetünk a tömörítéssel, és mekkora most az együttes méretük? */
    const shrinkable = useMemo(() => {
        const files = entries.filter((e) => isShrinkable(e.file));

        return {
            count: files.length,
            bytes: files.reduce((sum, e) => sum + e.file.size, 0),
        };
    }, [entries]);

    const busy = phase === 'preparing' || phase === 'uploading';

    const removeEntry = (index: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== index));
        setNames((prev) => prev.filter((_, i) => i !== index));
    };

    const renameEntry = (index: number, value: string) =>
        setNames((prev) => prev.map((n, i) => (i === index ? value : n)));

    const close = () => {
        if (busy) return;
        onClose();
    };

    const submit = async () => {
        let list = entries;
        let savedBytes = 0;

        // 1. Képek előkészítése (kicsinyítés + újratömörítés) a böngészőben.
        if (compress && shrinkable.count > 0) {
            setPhase('preparing');
            setPrepared({ done: 0, total: entries.length });

            const shrunk = await shrinkImages(
                entries.map((e) => e.file),
                {},
                (done, total) => setPrepared({ done, total }),
            );

            list = entries.map((entry, i) => ({ ...entry, file: shrunk.files[i] }));
            savedBytes = Math.max(0, shrunk.beforeBytes - shrunk.afterBytes);
        }

        // 2. Küldés szakaszokban.
        const toSend = totalBytes(list);
        setSendBytes(toSend);
        setPhase('uploading');
        setProgress({ files: 0, bytes: 0 });

        const outcome = await runUpload(
            {
                entries: list,
                // Átnevezés csak lapos, kis feltöltésnél; egyébként marad az eredeti név.
                names: list.map((_, i) => (structured ? '' : (names[i] ?? ''))),
                folderId,
                category,
                projectId,
            },
            (loadedBytes, doneFiles) =>
                setProgress({ files: doneFiles, bytes: loadedBytes }),
        );

        setResult({ ...outcome, savedBytes });
        setPhase('done');
        router.reload();
    };

    const percent =
        phase === 'preparing'
            ? prepared.total > 0
                ? Math.round((prepared.done / prepared.total) * 100)
                : 0
            : sendBytes > 0
              ? Math.min(100, Math.round((progress.bytes / sendBytes) * 100))
              : 0;

    return (
        <Dialog open={open} onClose={close} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
                <DialogPanel className="o-card flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none p-5 sm:rounded-b-card sm:p-6">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-sidebar">
                        {folders > 0 ? <FolderTree size={17} /> : <FileUp size={17} />}
                        {phase === 'done'
                            ? 'Feltöltés kész'
                            : `Feltöltés (${entries.length} fájl${folders > 0 ? `, ${folders} mappa` : ''})`}
                    </DialogTitle>

                    {phase === 'done' && result ? (
                        /* ---------------- eredmény ---------------- */
                        <div className="mt-3 overflow-y-auto">
                            <div className="flex items-start gap-2 rounded-md border border-accent-100 bg-accent-50 px-3 py-2.5 text-sm text-accent-700">
                                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                                <span>
                                    {result.uploaded} fájl feltöltve
                                    {result.folders > 0 ? `, ${result.folders} mappa létrejött` : ''}
                                    .
                                    {result.savedBytes > 0 && (
                                        <>
                                            {' '}
                                            A képtömörítés {fmtBytes(result.savedBytes)} adatforgalmat
                                            spórolt.
                                        </>
                                    )}
                                </span>
                            </div>

                            {result.failures.length > 0 && (
                                <div className="mt-2 space-y-1 rounded-md border border-coral/30 bg-coral/10 px-3 py-2.5 text-sm text-[#9c3d2b]">
                                    {result.failures.map((f, i) => (
                                        <p key={i} className="flex items-start gap-2">
                                            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                            <span>{f}</span>
                                        </p>
                                    ))}
                                </div>
                            )}

                            <div className="mt-5">
                                <button className="btn-primary" onClick={onClose}>
                                    Kész
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="-mx-1 mt-1 flex-1 overflow-y-auto px-1">
                                {notice ? (
                                    <p className="mt-1 flex items-start gap-2 rounded-md border border-amberwarn/30 bg-amberwarn/10 px-3 py-2 text-xs text-[#8a5e17]">
                                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                        <span>{notice}</span>
                                    </p>
                                ) : (
                                    <p className="text-xs text-ink-faint">
                                        {structured
                                            ? 'A mappaszerkezet a feltöltéssel együtt jön létre; a már meglévő mappákba a fájlok bekerülnek.'
                                            : 'A név átírható – a fájl ezzel a névvel jelenik meg és tölthető le. A kiterjesztés változatlan marad.'}
                                    </p>
                                )}

                                {/* Sok fájl mappa-információ nélkül: a szerkezet nem őrizhető meg,
                                    mert a böngésző nem árulta el, honnan jöttek. */}
                                {! notice && folders === 0 && entries.length > 3 && (
                                    <p className="mt-2 flex items-start gap-2 rounded-md border border-line bg-cream/60 px-3 py-2 text-xs text-ink-soft">
                                        <FolderTree size={14} className="mt-0.5 shrink-0" />
                                        <span>
                                            Ezek a fájlok mappaszerkezet nélkül érkeztek, ezért mind
                                            ebbe a mappába kerülnek. Ha a mappákat is meg szeretné
                                            tartani, zárja be ezt az ablakot, és a{' '}
                                            <strong>„Feltöltés ▾ → Mappa feltöltése (almappákkal)…”</strong>{' '}
                                            gombbal a befoglaló mappát válassza ki.
                                        </span>
                                    </p>
                                )}

                                {oversized.length > 0 && (
                                    <p className="mt-2 flex items-start gap-2 rounded-md border border-amberwarn/30 bg-amberwarn/10 px-3 py-2 text-xs text-[#8a5e17]">
                                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                        <span>
                                            {oversized.length} fájl kimarad, mert nagyobb 120 MB-nál
                                            {oversized.length <= 3
                                                ? `: ${oversized.join(', ')}`
                                                : '.'}
                                        </span>
                                    </p>
                                )}

                                {/* Képtömörítés */}
                                {shrinkable.count > 0 && (
                                    <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-md border border-accent-100 bg-accent-50/60 px-3 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={compress}
                                            disabled={busy}
                                            onChange={(e) => setCompress(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 rounded-sm border-line text-accent focus:ring-accent/30"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-1.5 text-[13px] font-medium text-accent-700">
                                                <Sparkles size={14} />
                                                Képek tömörítése feltöltés előtt
                                            </span>
                                            <span className="mt-0.5 block text-xs text-ink-soft">
                                                {shrinkable.count} kép ({fmtBytes(shrinkable.bytes)}) —
                                                legfeljebb 2560 képpontos élre kicsinyítve, jellemzően a
                                                méret töredékére. Kapcsolja ki, ha az eredeti
                                                felbontásra van szükség.
                                            </span>
                                        </span>
                                    </label>
                                )}

                                <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-line bg-cream/40 p-2">
                                    {entries.slice(0, LIST_LIMIT).map((entry, i) => (
                                        <div
                                            key={`${entry.path}/${entry.file.name}-${i}`}
                                            className="flex items-center gap-2 rounded bg-white px-2.5 py-1.5"
                                        >
                                            {structured ? (
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm text-ink">
                                                        {entry.file.name}
                                                    </p>
                                                    {entry.path && (
                                                        <p className="truncate text-[11px] text-ink-faint">
                                                            {entry.path.replace(/\//g, ' \\ ')}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex min-w-0 flex-1 items-center">
                                                    <input
                                                        value={names[i] ?? ''}
                                                        onChange={(e) => renameEntry(i, e.target.value)}
                                                        placeholder="Fájlnév"
                                                        className="min-w-0 flex-1 rounded-l-md border-line bg-white py-1 text-sm focus:border-accent focus:ring-accent/30"
                                                    />
                                                    <span className="rounded-r-md border border-l-0 border-line bg-cream px-2 py-1 text-xs text-ink-faint">
                                                        {extOf(entry.file.name) || '—'}
                                                    </span>
                                                </div>
                                            )}
                                            <span className="shrink-0 text-xs text-ink-faint">
                                                {fmtBytes(entry.file.size)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeEntry(i)}
                                                disabled={busy}
                                                className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-cream hover:text-coral disabled:opacity-40"
                                                title="Eltávolítás a feltöltésből"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    {entries.length > LIST_LIMIT && (
                                        <p className="px-2 py-1.5 text-center text-xs text-ink-faint">
                                            …és további {entries.length - LIST_LIMIT} fájl.
                                        </p>
                                    )}

                                    {entries.length === 0 && (
                                        <p className="px-2 py-3 text-center text-xs text-ink-faint">
                                            Nincs kiválasztott fájl.
                                        </p>
                                    )}
                                </div>

                                <p className="mt-1.5 text-xs text-ink-faint">
                                    Összesen {entries.length} fájl, {fmtBytes(bytes)}
                                    {folders > 0 ? ` · ${folders} mappa` : ''}
                                </p>

                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <InputLabel value="Kategória" />
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            disabled={busy}
                                            className="block w-full rounded-md border-line bg-white text-sm focus:border-accent focus:ring-accent/30"
                                        >
                                            <option value="">Automatikus</option>
                                            {Object.entries(categories).map(([v, l]) => (
                                                <option key={v} value={v}>
                                                    {l}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <InputLabel value="Projekt" />
                                        <select
                                            value={projectId}
                                            onChange={(e) =>
                                                setProjectId(
                                                    e.target.value ? Number(e.target.value) : '',
                                                )
                                            }
                                            disabled={busy}
                                            className="block w-full rounded-md border-line bg-white text-sm focus:border-accent focus:ring-accent/30"
                                        >
                                            <option value="">– Nincs –</option>
                                            {projects.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {busy && (
                                <div className="mt-4 shrink-0">
                                    <div className="h-2 overflow-hidden rounded-sm bg-line">
                                        <div
                                            className="h-full bg-accent transition-all"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-ink-faint">
                                        {phase === 'preparing'
                                            ? `Képek előkészítése… ${prepared.done} / ${prepared.total}`
                                            : `Feltöltés… ${progress.files} / ${entries.length} fájl (${percent}%)`}
                                    </p>
                                </div>
                            )}

                            <div className="mt-5 flex shrink-0 gap-2">
                                <button
                                    className="btn-primary"
                                    onClick={submit}
                                    disabled={busy || entries.length === 0}
                                >
                                    Feltöltés
                                </button>
                                <button className="btn-ghost" onClick={close} disabled={busy}>
                                    Mégse
                                </button>
                            </div>
                        </>
                    )}
                </DialogPanel>
            </div>
        </Dialog>
    );
}
