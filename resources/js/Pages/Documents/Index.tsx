import { ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Download, FolderOpen, Plus, Search, Upload, X } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtBytes, fmtDate } from '@/lib/format';
import { CATEGORY_LABELS, fileIcon } from '@/lib/documents';
import type { DocumentRow, Option, Paginator, ProjectOption } from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    documents: Paginator<DocumentRow>;
    filters: { search: string; category: string; project: number | null };
    categories: Record<string, string>;
    projects: ProjectOption[];
    partners: Option[];
}

const selectClass =
    'rounded-md border-line bg-white py-2 text-sm focus:border-accent focus:ring-accent/30';

interface UploadFormData {
    title: string;
    category: string;
    project_id: number | '';
    partner_id: number | '';
    description: string;
    file: File | null;
    [key: string]: string | number | File | null;
}

function UploadPanel({
    categories,
    projects,
    partners,
    presetProject,
    onClose,
}: {
    categories: Record<string, string>;
    projects: ProjectOption[];
    partners: Option[];
    presetProject: number | null;
    onClose: () => void;
}) {
    const form = useForm<UploadFormData>({
        title: '',
        category: 'egyeb',
        project_id: presetProject ?? '',
        partner_id: '',
        description: '',
        file: null,
    });

    const pickFile = (f: File | null) => {
        form.setData('file', f);
        if (f && !form.data.title) {
            form.setData('title', f.name.replace(/\.[^.]+$/, ''));
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('documents.store'), {
            forceFormData: true,
        });
    };

    return (
        <form onSubmit={submit} className="o-card mb-5 p-5">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                    Fájl feltöltése
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-ink-faint hover:bg-cream hover:text-ink"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <InputLabel value="Fájl *" />
                    <input
                        type="file"
                        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                        className="block w-full cursor-pointer rounded-md border border-line bg-white text-sm text-ink-soft file:mr-3 file:cursor-pointer file:border-0 file:bg-accent file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-accent-600"
                    />
                    <InputError message={form.errors.file} />
                </div>

                <div>
                    <InputLabel value="Megnevezés *" />
                    <TextInput
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                    />
                    <InputError message={form.errors.title} />
                </div>

                <div>
                    <InputLabel value="Kategória *" />
                    <select
                        value={form.data.category}
                        onChange={(e) => form.setData('category', e.target.value)}
                        className={`${selectClass} w-full`}
                    >
                        {Object.entries(categories).map(([v, l]) => (
                            <option key={v} value={v}>
                                {l}
                            </option>
                        ))}
                    </select>
                    <InputError message={form.errors.category} />
                </div>

                <div>
                    <InputLabel value="Projekt" />
                    <select
                        value={form.data.project_id}
                        onChange={(e) =>
                            form.setData('project_id', e.target.value ? Number(e.target.value) : '')
                        }
                        className={`${selectClass} w-full`}
                    >
                        <option value="">– Nincs projekthez kötve –</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                    <InputError message={form.errors.project_id} />
                </div>

                <div>
                    <InputLabel value="Partner (megrendelő / alvállalkozó)" />
                    <select
                        value={form.data.partner_id}
                        onChange={(e) =>
                            form.setData('partner_id', e.target.value ? Number(e.target.value) : '')
                        }
                        className={`${selectClass} w-full`}
                    >
                        <option value="">– Nincs partnerhez kötve –</option>
                        {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                    <InputError message={form.errors.partner_id} />
                </div>

                <div className="sm:col-span-2">
                    <InputLabel value="Leírás" />
                    <textarea
                        value={form.data.description}
                        onChange={(e) => form.setData('description', e.target.value)}
                        rows={2}
                        className="block w-full rounded-md border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40"
                    />
                    <InputError message={form.errors.description} />
                </div>
            </div>

            {form.progress && (
                <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-sm bg-line">
                        <div
                            className="h-full bg-accent transition-all"
                            style={{ width: `${form.progress.percentage ?? 0}%` }}
                        />
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">
                        Feltöltés… {form.progress.percentage ?? 0}%
                    </p>
                </div>
            )}

            <div className="mt-5 flex gap-2 border-t border-line pt-4">
                <button type="submit" className="btn-primary" disabled={form.processing}>
                    <Upload size={15} />
                    Feltöltés
                </button>
                <button type="button" className="btn-ghost" onClick={onClose}>
                    Mégse
                </button>
            </div>
        </form>
    );
}

export default function Index() {
    const { documents, filters, categories, projects, partners, auth } =
        usePageProps<IndexProps>();
    const canCreate = auth.permissions.includes('documents.create');

    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(filters.category);
    const [project, setProject] = useState<string>(filters.project ? String(filters.project) : '');
    const [uploadOpen, setUploadOpen] = useState(false);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('documents.index'),
                {
                    search: search || undefined,
                    category: category || undefined,
                    project: project || undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search, category, project]);

    return (
        <>
            <Head title="Fájlkezelő" />

            <PageHeader
                title="Fájlkezelő"
                subtitle="Tervrajzok, engedélyek, szerződések és fotók — verziókövetéssel."
                actions={
                    canCreate && (
                        <button className="btn-primary" onClick={() => setUploadOpen((v) => !v)}>
                            <Plus size={16} />
                            Fájl feltöltése
                        </button>
                    )
                }
            />

            {uploadOpen && canCreate && (
                <UploadPanel
                    categories={categories}
                    projects={projects}
                    partners={partners}
                    presetProject={filters.project}
                    onClose={() => setUploadOpen(false)}
                />
            )}

            {/* Szűrők */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Keresés névre, fájlnévre…"
                        className="w-full rounded-md border-line bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:ring-accent/30"
                    />
                </div>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`${selectClass} sm:w-48`}
                >
                    <option value="">Minden kategória</option>
                    {Object.entries(categories).map(([v, l]) => (
                        <option key={v} value={v}>
                            {l}
                        </option>
                    ))}
                </select>
                <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className={`${selectClass} sm:w-64`}
                >
                    <option value="">Minden projekt</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.label}
                        </option>
                    ))}
                </select>
            </div>

            {documents.data.length === 0 ? (
                <div className="o-card flex flex-col items-center px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-50 text-accent">
                        <FolderOpen size={26} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold text-sidebar">Nincs találat</h2>
                    <p className="mt-1 max-w-sm text-sm text-ink-soft">
                        {filters.search || filters.category || filters.project
                            ? 'Próbáljon másik keresőszót vagy szűrőt.'
                            : 'Töltse fel az első dokumentumot — projekthez és partnerhez is kötheti.'}
                    </p>
                </div>
            ) : (
                <div className="o-card divide-y divide-line">
                    {documents.data.map((d) => {
                        const Icon = fileIcon(d.mime_type, d.original_filename);
                        return (
                            <div
                                key={d.id}
                                className="flex items-center gap-3 px-4 py-3 transition hover:bg-cream/50"
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent">
                                    <Icon size={18} />
                                </span>

                                <Link
                                    href={route('documents.show', d.id)}
                                    className="min-w-0 flex-1"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-ink hover:text-accent-700">
                                            {d.title}
                                        </span>
                                        <span className="chip chip-grey shrink-0">
                                            {CATEGORY_LABELS[d.category] ?? d.category}
                                        </span>
                                        {d.version_number > 1 && (
                                            <span className="shrink-0 font-mono text-xs text-ink-faint">
                                                v{d.version_number}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-0.5 truncate text-xs text-ink-faint">
                                        {d.original_filename}
                                        {d.project && <span> · {d.project.code}</span>}
                                        {d.partner_name && <span> · {d.partner_name}</span>}
                                        <span> · {fmtBytes(d.size_bytes)}</span>
                                        <span> · {fmtDate(d.updated_at)}</span>
                                        {d.uploader_name && <span> · {d.uploader_name}</span>}
                                    </div>
                                </Link>

                                {d.download_version_id && (
                                    <a
                                        href={route('documents.versions.download', d.download_version_id)}
                                        className="shrink-0 rounded-md p-2 text-ink-faint hover:bg-white hover:text-accent"
                                        aria-label="Letöltés"
                                    >
                                        <Download size={17} />
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {documents.data.length > 0 && documents.links.length > 3 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
                    {documents.links.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                preserveState
                                className={`rounded-md px-3 py-1.5 text-sm ${
                                    link.active
                                        ? 'bg-accent font-medium text-white'
                                        : 'text-ink-soft hover:bg-white'
                                }`}
                            >
                                {link.label.replace('&laquo;', '«').replace('&raquo;', '»')}
                            </Link>
                        ) : (
                            <span key={i} className="px-3 py-1.5 text-sm text-ink-faint">
                                {link.label.replace('&laquo;', '«').replace('&raquo;', '»')}
                            </span>
                        ),
                    )}
                </div>
            )}
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
