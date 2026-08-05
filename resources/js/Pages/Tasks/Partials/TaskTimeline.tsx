import { useCallback, useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { ArrowRight, MessageSquare, Send, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { fmtDateTime } from '@/lib/format';
import type { TaskTimelineEntry } from '@/types/models';

/**
 * A feladat idővonala: hozzászólások és státuszváltások időrendben, alul az
 * új hozzászólás mezővel. A bejegyzéseket a modal nyitásakor töltjük külön
 * kéréssel, hogy a feladatlista ne cipelje magával minden feladat előzményét.
 */
export default function TaskTimeline({
    taskId,
    statuses,
}: {
    taskId: number;
    statuses: Record<string, string>;
}) {
    const [entries, setEntries] = useState<TaskTimelineEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch(route('tasks.timeline', taskId), {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            const json: { entries: TaskTimelineEntry[] } = await res.json();
            setEntries(json.entries);
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        setLoading(true);
        void load();
    }, [load]);

    const submit = () => {
        const text = body.trim();
        if (text === '' || sending) return;
        setSending(true);
        // Inertia-hívás (nem sima fetch), hogy a listán a hozzászólás-számláló
        // is frissüljön; a preserveState tartja nyitva a modalt.
        router.post(
            route('tasks.comments.store', taskId),
            { body: text },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setBody('');
                    void load();
                },
                onFinish: () => setSending(false),
            },
        );
    };

    const remove = (id: number) => {
        if (!confirm('Biztosan törli ezt a hozzászólást?')) return;
        router.delete(route('tasks.comments.destroy', id), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => void load(),
        });
    };

    const commentCount = entries.filter((e) => e.kind === 'comment').length;

    return (
        <div className="border-t border-line pt-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-sidebar">
                <MessageSquare size={15} className="text-ink-faint" />
                Idővonal
                {commentCount > 0 && (
                    <span className="rounded-sm bg-cream px-1.5 py-0.5 text-[11px] font-medium text-ink-faint">
                        {commentCount} hozzászólás
                    </span>
                )}
            </h3>

            {/* Telefonon nincs belső görgetés: az ablak maga görög, a dobozba
                zárt görgetés ujjal nehezen célozható. */}
            <div className="mt-3 space-y-3 pr-1 sm:max-h-72 sm:overflow-y-auto">
                {loading ? (
                    <p className="text-xs text-ink-faint">Betöltés…</p>
                ) : entries.length === 0 ? (
                    <p className="text-xs text-ink-faint">
                        Még nincs bejegyzés. Írja meg az első hozzászólást.
                    </p>
                ) : (
                    entries.map((entry) => (
                        <TimelineRow
                            key={entry.id}
                            entry={entry}
                            statuses={statuses}
                            onDelete={() => remove(entry.id)}
                        />
                    ))
                )}
            </div>

            <div className="mt-3 flex items-end gap-2">
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    rows={2}
                    placeholder="Hozzászólás írása…"
                    className="block w-full rounded-md border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                />
                <button
                    type="button"
                    onClick={submit}
                    disabled={body.trim() === '' || sending}
                    className="btn-primary shrink-0 max-sm:h-[46px] max-sm:px-4"
                    title="Hozzászólás küldése (Ctrl+Enter)"
                >
                    <Send size={15} />
                </button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">
                A feladat felelősei harang- és e-mail értesítést kapnak a hozzászólásról.
            </p>
        </div>
    );
}

/* ------------------------------------------------------------------ */

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
}

function TimelineRow({
    entry,
    statuses,
    onDelete,
}: {
    entry: TaskTimelineEntry;
    statuses: Record<string, string>;
    onDelete: () => void;
}) {
    const who = entry.user?.name ?? 'Rendszer';

    // Státuszváltás: egysoros, halvány bejegyzés (ki, mikor, honnan hová).
    if (entry.kind === 'status') {
        return (
            <div className="flex items-center gap-2 text-xs text-ink-faint">
                <span className="ml-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line" />
                <span className="font-medium text-ink-soft">{who}</span>
                {entry.from_status ? (
                    <span className="flex items-center gap-1">
                        {statuses[entry.from_status] ?? entry.from_status}
                        <ArrowRight size={11} />
                        <span className="font-medium text-ink-soft">
                            {statuses[entry.to_status ?? ''] ?? entry.to_status}
                        </span>
                    </span>
                ) : (
                    <span>
                        létrehozta —{' '}
                        <span className="font-medium text-ink-soft">
                            {statuses[entry.to_status ?? ''] ?? entry.to_status}
                        </span>
                    </span>
                )}
                <span className="ml-auto shrink-0">{fmtDateTime(entry.created_at)}</span>
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            <span
                title={who}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-[10px] font-semibold text-white"
            >
                {entry.user ? initials(entry.user.name) : '–'}
            </span>
            <div className={clsx('min-w-0 flex-1 rounded-md border border-line bg-cream/40 px-2.5 py-1.5')}>
                <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-ink">{who}</span>
                    <span className="text-ink-faint">{fmtDateTime(entry.created_at)}</span>
                    {entry.can_delete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="ml-auto shrink-0 rounded p-0.5 text-ink-faint hover:text-coral"
                            title="Hozzászólás törlése"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
                <p className="mt-0.5 whitespace-pre-line break-words text-sm text-ink-soft">
                    {entry.body}
                </p>
            </div>
        </div>
    );
}
