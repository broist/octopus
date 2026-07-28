import { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { AlertTriangle, CheckCircle2, FileUp, FolderTree, X } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import { fmtBytes } from '@/lib/format';
import {
    type UploadEntry,
    MAX_FILE_BYTES,
    buildBatches,
    folderCount,
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

/** Fájlnév kiterjesztés nélkül (átnevezés alapértéke). */
function baseName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

function extOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot) : '';
}

/** A szerver hibaüzenete olvasható formában. */
function errorText(err: unknown): string {
    const res = (
        err as {
            response?: {
                status?: number;
                data?: { message?: string; errors?: Record<string, string[]> };
            };
        }
    ).response;

    if (!res) return 'A feltöltés megszakadt (hálózati hiba).';
    if (res.status === 413) return 'A csomag túl nagy a kiszolgálónak.';
    if (res.status === 403) return 'Nincs jogosultsága ide feltölteni.';

    const first = Object.values(res.data?.errors ?? {})[0]?.[0];

    return first ?? res.data?.message ?? `Hiba (${res.status ?? '?'}).`;
}

/**
 * Feltöltés megerősítő: a kiválasztott fájlok/mappák listája, kevés fájlnál
 * fájlonként átnevezhető névvel, opcionális kategória- és projekt-kötéssel.
 *
 * A küldés szakaszokban megy (axiosszal, nem Inertiával), hogy egy sok fájlos
 * mappa is átférjen a PHP darabszám- és méretkorlátain; a párbeszéd közben
 * összesített haladást, végül eredmény-összegzést mutat.
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

    const [phase, setPhase] = useState<'ready' | 'uploading' | 'done'>('ready');
    const [progress, setProgress] = useState({ files: 0, bytes: 0 });
    const [result, setResult] = useState<{
        uploaded: number;
        folders: number;
        failures: string[];
    } | null>(null);

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
        setProgress({ files: 0, bytes: 0 });
        setResult(null);
    }, [open, incoming]);

    const folders = useMemo(() => folderCount(entries), [entries]);
    const bytes = useMemo(() => totalBytes(entries), [entries]);
    const structured = folders > 0 || entries.length > RENAME_LIMIT;

    const removeEntry = (index: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== index));
        setNames((prev) => prev.filter((_, i) => i !== index));
    };

    const renameEntry = (index: number, value: string) =>
        setNames((prev) => prev.map((n, i) => (i === index ? value : n)));

    const close = () => {
        if (phase === 'uploading') return;
        onClose();
    };

    const submit = async () => {
        setPhase('uploading');

        const batches = buildBatches(entries);
        const failures: string[] = [];
        let uploaded = 0;
        let created = 0;
        let doneBytes = 0;
        let doneFiles = 0;

        for (const batch of batches) {
            const form = new FormData();

            batch.forEach((entry) => {
                const index = entries.indexOf(entry);
                form.append('files[]', entry.file);
                form.append('paths[]', entry.path);
                // Átnevezés csak lapos, kis feltöltésnél; egyébként marad az eredeti név.
                form.append('names[]', structured ? '' : (names[index] ?? ''));
            });

            if (folderId !== null) form.append('folder_id', String(folderId));
            if (category) form.append('category', category);
            if (projectId !== '') form.append('project_id', String(projectId));

            const batchBytes = totalBytes(batch);

            try {
                const { data } = await window.axios.post(route('documents.store'), form, {
                    onUploadProgress: (event: { loaded?: number }) =>
                        setProgress({
                            files: doneFiles,
                            bytes: doneBytes + (event.loaded ?? 0),
                        }),
                });

                uploaded += (data?.uploaded as number) ?? batch.length;
                created += (data?.folders_created as number) ?? 0;
            } catch (err) {
                failures.push(`${batch.length} fájl kimaradt — ${errorText(err)}`);
            }

            doneBytes += batchBytes;
            doneFiles += batch.length;
            setProgress({ files: doneFiles, bytes: doneBytes });
        }

        setResult({ uploaded, folders: created, failures });
        setPhase('done');
        router.reload();
    };

    const percent = bytes > 0 ? Math.min(100, Math.round((progress.bytes / bytes) * 100)) : 0;

    return (
        <Dialog open={open} onClose={close} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="o-card w-full max-w-lg p-6">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-sidebar">
                        {folders > 0 ? <FolderTree size={17} /> : <FileUp size={17} />}
                        {phase === 'done'
                            ? 'Feltöltés kész'
                            : `Feltöltés (${entries.length} fájl${folders > 0 ? `, ${folders} mappa` : ''})`}
                    </DialogTitle>

                    {phase === 'done' && result ? (
                        /* ---------------- eredmény ---------------- */
                        <div className="mt-3">
                            <div className="flex items-start gap-2 rounded-md border border-accent-100 bg-accent-50 px-3 py-2.5 text-sm text-accent-700">
                                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                                <span>
                                    {result.uploaded} fájl feltöltve
                                    {result.folders > 0 ? `, ${result.folders} mappa létrejött` : ''}
                                    .
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
                            {notice ? (
                                <p className="mt-2 flex items-start gap-2 rounded-md border border-amberwarn/30 bg-amberwarn/10 px-3 py-2 text-xs text-[#8a5e17]">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                    <span>{notice}</span>
                                </p>
                            ) : (
                                <p className="mt-1 text-xs text-ink-faint">
                                    {structured
                                        ? 'A mappaszerkezet a feltöltéssel együtt jön létre; a már meglévő mappákba a fájlok bekerülnek.'
                                        : 'A név átírható – a fájl ezzel a névvel jelenik meg és tölthető le. A kiterjesztés változatlan marad.'}
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

                            <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-line bg-cream/40 p-2">
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
                                            disabled={phase === 'uploading'}
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

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div>
                                    <InputLabel value="Kategória" />
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        disabled={phase === 'uploading'}
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
                                        disabled={phase === 'uploading'}
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

                            {phase === 'uploading' && (
                                <div className="mt-4">
                                    <div className="h-2 overflow-hidden rounded-sm bg-line">
                                        <div
                                            className="h-full bg-accent transition-all"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-ink-faint">
                                        Feltöltés… {progress.files} / {entries.length} fájl (
                                        {percent}%)
                                    </p>
                                </div>
                            )}

                            <div className="mt-5 flex gap-2">
                                <button
                                    className="btn-primary"
                                    onClick={submit}
                                    disabled={phase === 'uploading' || entries.length === 0}
                                >
                                    Feltöltés
                                </button>
                                <button
                                    className="btn-ghost"
                                    onClick={close}
                                    disabled={phase === 'uploading'}
                                >
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
