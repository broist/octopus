import { ReactNode, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Cloud,
    Download,
    History,
    Pencil,
    RotateCcw,
    Trash2,
    Upload,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtBytes, fmtDateTime } from '@/lib/format';
import { CATEGORY_LABELS } from '@/lib/documents';
import type { DocumentVersionRow, Option, ProjectOption } from '@/types/models';

interface ShowProps extends Record<string, unknown> {
    document: {
        id: number;
        title: string;
        category: string;
        description: string | null;
        folder_id: number | null;
        folder_path: string;
        project: { id: number; code: string; name: string } | null;
        partner: { id: number; name: string } | null;
        project_id: number | null;
        partner_id: number | null;
        uploader_name: string | null;
        created_at: string;
        preview_version_id: number | null;
        preview_mime: string | null;
    };
    versions: DocumentVersionRow[];
    categories: Record<string, string>;
    projects: ProjectOption[];
    partners: Option[];
}

const selectClass =
    'block w-full rounded-md border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';

export default function Show() {
    const { document: doc, versions, categories, projects, partners, auth } =
        usePageProps<ShowProps>();
    const canEdit = auth.permissions.includes('documents.edit');
    const canDelete = auth.permissions.includes('documents.delete');
    const canUploadVersion =
        canEdit || auth.permissions.includes('documents.create');

    const [editing, setEditing] = useState(false);
    const [uploading, setUploading] = useState(false);

    const metaForm = useForm({
        title: doc.title,
        category: doc.category,
        project_id: doc.project_id ?? ('' as number | ''),
        partner_id: doc.partner_id ?? ('' as number | ''),
        description: doc.description ?? '',
    });

    const versionForm = useForm<{ file: File | null; note: string; [k: string]: File | null | string }>({
        file: null,
        note: '',
    });

    const current = versions.find((v) => v.is_current);

    const saveMeta = (e: React.FormEvent) => {
        e.preventDefault();
        metaForm.put(route('documents.update', doc.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    const uploadVersion = (e: React.FormEvent) => {
        e.preventDefault();
        versionForm.post(route('documents.versions.store', doc.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                versionForm.reset();
                setUploading(false);
            },
        });
    };

    const destroy = () => {
        if (confirm(`Biztosan törli a(z) „${doc.title}" dokumentumot? A verziói is elérhetetlenné válnak.`)) {
            router.delete(route('documents.destroy', doc.id));
        }
    };

    return (
        <>
            <Head title={doc.title} />

            <div className="mb-6">
                <Link
                    href={route(
                        'documents.index',
                        doc.folder_id ? { folder: doc.folder_id } : {},
                    )}
                    className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
                >
                    <ArrowLeft size={15} />
                    {doc.folder_path}
                </Link>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="chip chip-grey">
                                {CATEGORY_LABELS[doc.category] ?? doc.category}
                            </span>
                            {current && (
                                <span className="font-mono text-xs text-ink-faint">
                                    v{current.version_number} · {fmtBytes(current.size_bytes)}
                                </span>
                            )}
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-sidebar">
                            {doc.title}
                        </h1>
                        <p className="mt-1 text-sm text-ink-soft">
                            {doc.project && (
                                <Link
                                    href={route('projects.show', doc.project.id)}
                                    className="font-medium text-accent hover:text-accent-700"
                                >
                                    {doc.project.code} – {doc.project.name}
                                </Link>
                            )}
                            {doc.project && doc.partner && ' · '}
                            {doc.partner?.name}
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {current && (
                            <a
                                href={route('documents.versions.download', current.id)}
                                className="btn-primary"
                            >
                                <Download size={15} />
                                Letöltés
                            </a>
                        )}
                        {canEdit && (
                            <button className="btn-ghost" onClick={() => setEditing((v) => !v)}>
                                <Pencil size={15} />
                                Adatok
                            </button>
                        )}
                        {canDelete && (
                            <button
                                onClick={destroy}
                                className="btn inline-flex border border-coral/40 bg-white text-coral hover:bg-coral/10"
                            >
                                <Trash2 size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {editing && canEdit && (
                <form onSubmit={saveMeta} className="o-card mb-5 p-5">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                        Dokumentum adatai
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <InputLabel value="Megnevezés *" />
                            <TextInput
                                value={metaForm.data.title}
                                onChange={(e) => metaForm.setData('title', e.target.value)}
                            />
                            <InputError message={metaForm.errors.title} />
                        </div>
                        <div>
                            <InputLabel value="Kategória *" />
                            <select
                                value={metaForm.data.category}
                                onChange={(e) => metaForm.setData('category', e.target.value)}
                                className={selectClass}
                            >
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
                                value={metaForm.data.project_id}
                                onChange={(e) =>
                                    metaForm.setData(
                                        'project_id',
                                        e.target.value ? Number(e.target.value) : '',
                                    )
                                }
                                className={selectClass}
                            >
                                <option value="">– Nincs –</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <InputLabel value="Partner" />
                            <select
                                value={metaForm.data.partner_id}
                                onChange={(e) =>
                                    metaForm.setData(
                                        'partner_id',
                                        e.target.value ? Number(e.target.value) : '',
                                    )
                                }
                                className={selectClass}
                            >
                                <option value="">– Nincs –</option>
                                {partners.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <InputLabel value="Leírás" />
                            <textarea
                                value={metaForm.data.description}
                                onChange={(e) => metaForm.setData('description', e.target.value)}
                                rows={2}
                                className={selectClass}
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2 border-t border-line pt-4">
                        <button type="submit" className="btn-primary" disabled={metaForm.processing}>
                            Mentés
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
                            Mégse
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Előnézet */}
                <div className="lg:col-span-2">
                    {doc.preview_version_id ? (
                        <div className="o-card overflow-hidden">
                            {doc.preview_mime === 'application/pdf' ? (
                                <iframe
                                    src={route('documents.versions.preview', doc.preview_version_id)}
                                    className="h-[70vh] w-full"
                                    title="Előnézet"
                                />
                            ) : (
                                <img
                                    src={route('documents.versions.preview', doc.preview_version_id)}
                                    alt={doc.title}
                                    className="max-h-[70vh] w-full bg-cream object-contain"
                                />
                            )}
                        </div>
                    ) : (
                        <div className="o-card flex h-48 items-center justify-center text-sm text-ink-faint">
                            Ehhez a fájltípushoz nincs előnézet — használja a letöltést.
                        </div>
                    )}

                    {doc.description && !editing && (
                        <div className="o-card mt-4 p-5">
                            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                                Leírás
                            </h2>
                            <p className="whitespace-pre-line text-sm text-ink">{doc.description}</p>
                        </div>
                    )}
                </div>

                {/* Verziók */}
                <section className="o-card h-fit">
                    <header className="flex items-center justify-between px-4 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                            <History size={15} />
                            Verziók
                        </h2>
                        {canUploadVersion && !uploading && (
                            <button
                                className="btn-ghost px-3 py-1.5 text-xs"
                                onClick={() => setUploading(true)}
                            >
                                <Upload size={13} />
                                Új verzió
                            </button>
                        )}
                    </header>

                    {uploading && (
                        <form
                            onSubmit={uploadVersion}
                            className="border-t border-line bg-cream/50 px-4 py-4"
                        >
                            <input
                                type="file"
                                onChange={(e) =>
                                    versionForm.setData('file', e.target.files?.[0] ?? null)
                                }
                                className="block w-full cursor-pointer rounded-md border border-line bg-white text-xs text-ink-soft file:mr-2 file:cursor-pointer file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                            />
                            <InputError message={versionForm.errors.file} />
                            <TextInput
                                value={versionForm.data.note}
                                onChange={(e) => versionForm.setData('note', e.target.value)}
                                placeholder="Mi változott? (opcionális)"
                                className="mt-2 text-sm"
                            />
                            {versionForm.progress && (
                                <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-line">
                                    <div
                                        className="h-full bg-accent transition-all"
                                        style={{
                                            width: `${versionForm.progress.percentage ?? 0}%`,
                                        }}
                                    />
                                </div>
                            )}
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="submit"
                                    className="btn-primary px-3 py-1.5 text-xs"
                                    disabled={versionForm.processing}
                                >
                                    Feltöltés
                                </button>
                                <button
                                    type="button"
                                    className="btn-ghost px-3 py-1.5 text-xs"
                                    onClick={() => setUploading(false)}
                                >
                                    Mégse
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="divide-y divide-line border-t border-line">
                        {versions.map((v) => (
                            <div key={v.id} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-ink">
                                        v{v.version_number}
                                    </span>
                                    {v.is_current && <span className="chip chip-green">Aktuális</span>}
                                    {v.stored_in_cloud && (
                                        <span title="Felhőben (S3) tárolva">
                                            <Cloud size={13} className="text-ink-faint" />
                                        </span>
                                    )}
                                    <span className="ml-auto text-xs text-ink-faint">
                                        {fmtBytes(v.size_bytes)}
                                    </span>
                                </div>
                                <p className="mt-0.5 truncate text-xs text-ink-soft">
                                    {v.original_filename}
                                </p>
                                {v.note && (
                                    <p className="mt-0.5 text-xs italic text-ink-faint">„{v.note}"</p>
                                )}
                                <p className="mt-0.5 text-xs text-ink-faint">
                                    {v.uploader_name ? `${v.uploader_name} · ` : ''}
                                    {fmtDateTime(v.created_at)}
                                </p>
                                <div className="mt-1.5 flex gap-2">
                                    <a
                                        href={route('documents.versions.download', v.id)}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-700"
                                    >
                                        <Download size={12} />
                                        Letöltés
                                    </a>
                                    {canEdit && !v.is_current && (
                                        <button
                                            onClick={() =>
                                                router.post(
                                                    route('documents.versions.make-current', v.id),
                                                    {},
                                                    { preserveScroll: true },
                                                )
                                            }
                                            className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"
                                        >
                                            <RotateCcw size={12} />
                                            Legyen ez az aktuális
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}

Show.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
