import { ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Camera, MapPin, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import InputLabel from '@/Components/ui/InputLabel';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtBytes } from '@/lib/format';
import type {
    DailyReportDetail,
    DailyReportProjectOption,
    Option,
} from '@/types/models';

interface CrewRow {
    subcontractor_id: string;
    headcount: string;
    note: string;
}

interface FormData {
    project_id: string;
    report_date: string;
    work_done: string;
    own_headcount: string;
    workers: number[];
    crews: CrewRow[];
    obstacles: string;
    material_movement: string;
    machine_movement: string;
    photos: File[];
    remove_photos: number[];
    [key: string]: string | number[] | CrewRow[] | File[];
}

interface FormProps extends Record<string, unknown> {
    report: DailyReportDetail | null;
    presetProjectId: number | null;
    projects: DailyReportProjectOption[];
    workers: Option[];
    subcontractors: Option[];
    today: string;
}

const selectClass =
    'block w-full rounded-lg border-line bg-white text-sm shadow-sm focus:border-accent focus:ring-accent/40';
const inputClass = selectClass;

export default function Form() {
    const { report, presetProjectId, projects, workers, subcontractors, today } =
        usePageProps<FormProps>();
    const editing = report !== null;

    const form = useForm<FormData>({
        project_id: report?.project?.id
            ? String(report.project.id)
            : presetProjectId
              ? String(presetProjectId)
              : '',
        report_date: report?.report_date ?? today,
        work_done: report?.work_done ?? '',
        own_headcount: report?.own_headcount != null ? String(report.own_headcount) : '',
        workers: report?.workers.map((w) => w.id) ?? [],
        crews:
            report?.crews.map((c) => ({
                subcontractor_id: String(c.subcontractor_id),
                headcount: c.headcount ? String(c.headcount) : '',
                note: c.note ?? '',
            })) ?? [],
        obstacles: report?.obstacles ?? '',
        material_movement: report?.material_movement ?? '',
        machine_movement: report?.machine_movement ?? '',
        photos: [],
        remove_photos: [],
    });

    const selectedProject = projects.find((p) => String(p.id) === form.data.project_id);
    const keptPhotos = report?.photos.filter((p) => !form.data.remove_photos.includes(p.id)) ?? [];

    const toggleWorker = (id: number) =>
        form.setData(
            'workers',
            form.data.workers.includes(id)
                ? form.data.workers.filter((w) => w !== id)
                : [...form.data.workers, id],
        );

    const addCrew = () =>
        form.setData('crews', [...form.data.crews, { subcontractor_id: '', headcount: '', note: '' }]);

    const updateCrew = (index: number, patch: Partial<CrewRow>) =>
        form.setData(
            'crews',
            form.data.crews.map((c, i) => (i === index ? { ...c, ...patch } : c)),
        );

    const removeCrew = (index: number) =>
        form.setData(
            'crews',
            form.data.crews.filter((_, i) => i !== index),
        );

    const addPhotos = (files: FileList | null) => {
        if (files && files.length > 0) {
            form.setData('photos', [...form.data.photos, ...Array.from(files)]);
        }
    };

    const removeNewPhoto = (index: number) =>
        form.setData(
            'photos',
            form.data.photos.filter((_, i) => i !== index),
        );

    const removeExistingPhoto = (id: number) =>
        form.setData('remove_photos', [...form.data.remove_photos, id]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({
            ...d,
            // Csak a kitöltött (kiválasztott alvállalkozójú) brigádsorokat küldjük.
            crews: (d.crews as CrewRow[]).filter((c) => c.subcontractor_id !== ''),
            ...(editing ? { _method: 'put' } : {}),
        }));
        const opts = { forceFormData: true, preserveScroll: true };
        if (editing && report) {
            form.post(route('daily-reports.update', report.id), opts);
        } else {
            form.post(route('daily-reports.store'), opts);
        }
    };

    return (
        <>
            <Head title={editing ? 'Napi jelentés szerkesztése' : 'Új napi jelentés'} />

            <PageHeader
                title={editing ? 'Napi jelentés szerkesztése' : 'Új napi jelentés'}
                subtitle="Rögzítse a helyszíni napló adatait – az időjárás a projekt helyszíne alapján automatikusan mentődik."
                actions={
                    <Link
                        href={editing && report ? route('daily-reports.show', report.id) : route('daily-reports.index')}
                        className="btn-ghost"
                    >
                        <ArrowLeft size={16} />
                        Vissza
                    </Link>
                }
            />

            <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5 pb-10">
                {/* Alapadatok */}
                <div className="o-card space-y-4 p-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <InputLabel value="Projekt *" />
                            <select
                                value={form.data.project_id}
                                onChange={(e) => form.setData('project_id', e.target.value)}
                                className={selectClass}
                            >
                                <option value="">— válasszon —</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.code} – {p.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={form.errors.project_id} />
                            {selectedProject && !selectedProject.has_coords && (
                                <p className="mt-1 inline-flex items-center gap-1 text-xs text-amberwarn">
                                    <MapPin size={12} />
                                    A projekten nincs koordináta – az időjárás nem lesz automatikus.
                                </p>
                            )}
                        </div>
                        <div>
                            <InputLabel value="Dátum *" />
                            <input
                                type="date"
                                value={form.data.report_date}
                                max={today}
                                onChange={(e) => form.setData('report_date', e.target.value)}
                                className={inputClass}
                            />
                            <InputError message={form.errors.report_date} />
                        </div>
                    </div>

                    <div>
                        <InputLabel value="Elvégzett munka *" />
                        <textarea
                            value={form.data.work_done}
                            onChange={(e) => form.setData('work_done', e.target.value)}
                            rows={4}
                            placeholder="Mit végeztek aznap? (pl. földmunka a keleti oldalon, zsaluzás az 1. szinten…)"
                            className={inputClass}
                        />
                        <InputError message={form.errors.work_done} />
                    </div>
                </div>

                {/* Létszám */}
                <div className="o-card space-y-4 p-5">
                    <h2 className="text-sm font-semibold text-sidebar">Létszám</h2>

                    <div className="max-w-[12rem]">
                        <InputLabel value="Saját dolgozók (fő)" />
                        <input
                            type="number"
                            min={0}
                            max={999}
                            value={form.data.own_headcount}
                            onChange={(e) => form.setData('own_headcount', e.target.value)}
                            placeholder="pl. 5"
                            className={inputClass}
                        />
                        <InputError message={form.errors.own_headcount} />
                    </div>

                    {workers.length > 0 && (
                        <div>
                            <InputLabel value="Kik dolgoztak (opcionális)" />
                            <div className="mt-1 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                                {workers.map((w) => {
                                    const active = form.data.workers.includes(w.id);
                                    return (
                                        <button
                                            type="button"
                                            key={w.id}
                                            onClick={() => toggleWorker(w.id)}
                                            className={clsx(
                                                'chip cursor-pointer border transition',
                                                active
                                                    ? 'border-accent bg-accent-50 text-accent-700'
                                                    : 'border-line bg-white text-ink-soft hover:border-accent/40',
                                            )}
                                        >
                                            {w.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Alvállalkozói brigádok */}
                    <div>
                        <div className="flex items-center justify-between">
                            <InputLabel value="Alvállalkozói brigádok" />
                            {subcontractors.length > 0 && (
                                <button type="button" onClick={addCrew} className="btn-ghost !py-1 text-xs text-accent">
                                    <Plus size={14} />
                                    Brigád
                                </button>
                            )}
                        </div>
                        {subcontractors.length === 0 ? (
                            <p className="text-xs text-ink-faint">
                                Nincs alvállalkozó rögzítve az Alvállalkozók modulban.
                            </p>
                        ) : form.data.crews.length === 0 ? (
                            <p className="text-xs text-ink-faint">Nincs alvállalkozói brigád aznap.</p>
                        ) : (
                            <div className="space-y-2">
                                {form.data.crews.map((crew, i) => (
                                    <div
                                        key={i}
                                        className="flex flex-col gap-2 rounded-lg border border-line bg-cream/40 p-2 sm:flex-row sm:items-center"
                                    >
                                        <select
                                            value={crew.subcontractor_id}
                                            onChange={(e) => updateCrew(i, { subcontractor_id: e.target.value })}
                                            className={`${selectClass} sm:flex-1`}
                                        >
                                            <option value="">— alvállalkozó —</option>
                                            {subcontractors.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min={0}
                                            max={999}
                                            value={crew.headcount}
                                            onChange={(e) => updateCrew(i, { headcount: e.target.value })}
                                            placeholder="fő"
                                            className={`${inputClass} sm:w-20`}
                                        />
                                        <input
                                            type="text"
                                            value={crew.note}
                                            onChange={(e) => updateCrew(i, { note: e.target.value })}
                                            placeholder="megjegyzés"
                                            className={`${inputClass} sm:flex-1`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeCrew(i)}
                                            className="btn-ghost !p-2 text-coral hover:bg-coral/10"
                                            title="Sor törlése"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Akadályok + mozgás */}
                <div className="o-card space-y-4 p-5">
                    <div>
                        <InputLabel value="Akadályok / események" />
                        <textarea
                            value={form.data.obstacles}
                            onChange={(e) => form.setData('obstacles', e.target.value)}
                            rows={2}
                            placeholder="Ami hátráltatta a munkát (anyaghiány, géphiba, hiányzó terv, hatósági bejárás…)"
                            className={inputClass}
                        />
                        <InputError message={form.errors.obstacles} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <InputLabel value="Anyagmozgás (opcionális)" />
                            <textarea
                                value={form.data.material_movement}
                                onChange={(e) => form.setData('material_movement', e.target.value)}
                                rows={2}
                                placeholder="Mi érkezett / mit használtak fel"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <InputLabel value="Gépmozgás (opcionális)" />
                            <textarea
                                value={form.data.machine_movement}
                                onChange={(e) => form.setData('machine_movement', e.target.value)}
                                rows={2}
                                placeholder="Milyen gép érkezett / távozott"
                                className={inputClass}
                            />
                        </div>
                    </div>
                </div>

                {/* Fotók */}
                <div className="o-card space-y-3 p-5">
                    <h2 className="text-sm font-semibold text-sidebar">Helyszíni fotók</h2>
                    <p className="text-xs text-ink-faint">
                        A fotók a Dokumentumtárba is bekerülnek, a projekthez rendelve.
                    </p>

                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-cream/40 px-4 py-6 text-sm text-ink-soft hover:border-accent/50">
                        <Camera size={18} className="text-accent" />
                        Fotó készítése / kiválasztása
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            onChange={(e) => {
                                addPhotos(e.target.files);
                                e.target.value = '';
                            }}
                            className="hidden"
                        />
                    </label>
                    <InputError message={form.errors.photos as string | undefined} />

                    {/* Meglévő fotók (szerkesztés) */}
                    {keptPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {keptPhotos.map((p) => (
                                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
                                    {p.is_image ? (
                                        <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-cream text-xs text-ink-faint">
                                            {p.name}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeExistingPhoto(p.id)}
                                        className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-90 hover:bg-coral"
                                        title="Fotó eltávolítása"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Új, még feltöltés előtti fotók */}
                    {form.data.photos.length > 0 && (
                        <ul className="space-y-1">
                            {form.data.photos.map((file, i) => (
                                <li
                                    key={i}
                                    className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-1.5 text-xs text-ink-soft"
                                >
                                    <span className="truncate">{file.name}</span>
                                    <span className="ml-2 flex items-center gap-2">
                                        <span className="text-ink-faint">{fmtBytes(file.size)}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeNewPhoto(i)}
                                            className="text-coral hover:text-coral/70"
                                            title="Eltávolítás"
                                        >
                                            <X size={13} />
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {form.progress && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div className="h-full bg-accent transition-all" style={{ width: `${form.progress.percentage}%` }} />
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button type="submit" className="btn-primary" disabled={form.processing}>
                        {editing ? 'Mentés' : 'Jelentés rögzítése'}
                    </button>
                    <Link
                        href={editing && report ? route('daily-reports.show', report.id) : route('daily-reports.index')}
                        className="btn-ghost"
                    >
                        Mégse
                    </Link>
                </div>
            </form>
        </>
    );
}

Form.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
