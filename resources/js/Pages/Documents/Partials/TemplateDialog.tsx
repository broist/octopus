import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ChevronRight, Folder as FolderIcon } from 'lucide-react';
import clsx from 'clsx';
import TextInput from '@/Components/ui/TextInput';

export interface FolderTemplate {
    key: string;
    label: string;
    description: string;
    root: string | null;
    name_label: string | null;
    name_hint: string | null;
    folder_count: number;
    preview: { name: string; children: string[] }[];
}

interface Props {
    open: boolean;
    templates: FolderTemplate[];
    /** Hova kerül a struktúra (útvonal-morzsákból összefűzve). */
    targetPath: string;
    projects: { id: number; label: string }[];
    busy?: boolean;
    onSubmit: (payload: { template: string; name: string | null }) => void;
    onClose: () => void;
}

/**
 * Kész mappastruktúra létrehozása sablonból. A bal oldalon a sablonok, jobbra
 * az előnézet — így látszik, pontosan mi jön létre, mielőtt rákattint.
 */
export default function TemplateDialog({
    open,
    templates,
    targetPath,
    projects,
    busy = false,
    onSubmit,
    onClose,
}: Props) {
    const [selected, setSelected] = useState(templates[0]?.key ?? '');
    const [name, setName] = useState('');

    const template = useMemo(
        () => templates.find((t) => t.key === selected),
        [templates, selected],
    );

    useEffect(() => {
        if (!open) return;
        setSelected(templates[0]?.key ?? '');
    }, [open, templates]);

    useEffect(() => {
        setName(template?.root ?? '');
    }, [template]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!template) return;
        if (template.root !== null && !name.trim()) return;
        onSubmit({ template: template.key, name: template.root !== null ? name.trim() : null });
    };

    /** Projektválasztó: a kód és a név alapján javasol mappanevet. */
    const applyProject = (label: string) => {
        if (!label) return;
        setName(label.replace(' – ', '_').replace(/\s+/g, '_'));
    };

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="o-card flex max-h-[85dvh] w-full max-w-3xl flex-col p-0">
                    <div className="border-b border-line px-6 py-4">
                        <DialogTitle className="text-base font-semibold text-sidebar">
                            Mappastruktúra sablonból
                        </DialogTitle>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Ide jön létre: <span className="font-medium text-ink">{targetPath}</span>
                            {' · '}a már meglévő mappák megmaradnak, csak a hiányzók jönnek létre.
                        </p>
                    </div>

                    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden sm:grid-cols-[16rem_1fr]">
                            {/* Sablonlista */}
                            <div className="max-h-64 overflow-y-auto border-b border-line p-2 sm:max-h-none sm:border-b-0 sm:border-r">
                                {templates.map((t) => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setSelected(t.key)}
                                        className={clsx(
                                            'mb-1 w-full rounded-md px-3 py-2 text-left transition',
                                            t.key === selected
                                                ? 'bg-accent-50 text-accent-700'
                                                : 'text-ink-soft hover:bg-cream hover:text-ink',
                                        )}
                                    >
                                        <div className="text-sm font-medium">{t.label}</div>
                                        <div className="text-[11px] text-ink-faint">
                                            {t.folder_count} mappa
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Előnézet */}
                            <div className="min-h-0 overflow-y-auto px-5 py-4">
                                {template && (
                                    <>
                                        <p className="text-sm text-ink-soft">{template.description}</p>

                                        {template.root !== null && (
                                            <div className="mt-4">
                                                <label className="mb-1 block text-sm font-medium text-ink">
                                                    {template.name_label ?? 'A létrejövő mappa neve'}
                                                </label>
                                                <TextInput
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                                {template.name_hint && (
                                                    <p className="mt-1 text-xs text-ink-faint">
                                                        {template.name_hint}
                                                    </p>
                                                )}
                                                {template.key === 'projekt' && projects.length > 0 && (
                                                    <select
                                                        defaultValue=""
                                                        onChange={(e) => applyProject(e.target.value)}
                                                        className="mt-2 w-full rounded-md border-line bg-white py-1.5 text-sm focus:border-accent focus:ring-accent/30"
                                                    >
                                                        <option value="">Név átvétele projektből…</option>
                                                        {projects.map((p) => (
                                                            <option key={p.id} value={p.label}>
                                                                {p.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-4">
                                            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                                                Ami létrejön
                                            </div>
                                            <div className="rounded-card border border-line bg-cream/40 p-3">
                                                {template.root !== null && (
                                                    <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                                                        <FolderIcon
                                                            size={14}
                                                            className="text-[#E8B04B]"
                                                            fill="#F3CE84"
                                                            strokeWidth={1.5}
                                                        />
                                                        {name || template.root}
                                                    </div>
                                                )}
                                                <ul className={clsx('space-y-1', template.root !== null && 'pl-4')}>
                                                    {template.preview.map((node) => (
                                                        <li key={node.name}>
                                                            <div className="flex items-center gap-1.5 text-sm text-ink">
                                                                <FolderIcon
                                                                    size={14}
                                                                    className="shrink-0 text-[#E8B04B]"
                                                                    fill="#F3CE84"
                                                                    strokeWidth={1.5}
                                                                />
                                                                {node.name}
                                                            </div>
                                                            {node.children.length > 0 && (
                                                                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 pl-5 text-[11px] text-ink-faint">
                                                                    {node.children.map((child, i) => (
                                                                        <span
                                                                            key={child}
                                                                            className="inline-flex items-center"
                                                                        >
                                                                            {i > 0 && (
                                                                                <ChevronRight
                                                                                    size={10}
                                                                                    className="mr-0.5 opacity-50"
                                                                                />
                                                                            )}
                                                                            {child}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 border-t border-line px-6 py-4">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={busy || !template || (template.root !== null && !name.trim())}
                            >
                                Létrehozás
                            </button>
                            <button type="button" className="btn-ghost" onClick={onClose}>
                                Mégse
                            </button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
