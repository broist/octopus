import { FormEventHandler, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import type { Option } from '@/types/models';

export interface ProjectFormData {
    parent_id: number | null;
    name: string;
    code: string;
    status: string;
    construction_type: string;
    client_id: number | '';
    project_manager_id: number | '';
    location_city: string;
    location_address: string;
    starts_on: string;
    ends_on: string;
    description: string;
}

interface ProjectFormProps {
    data: ProjectFormData;
    setData: <K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) => void;
    errors: Partial<Record<keyof ProjectFormData | 'depends_on', string>>;
    processing: boolean;
    onSubmit: FormEventHandler;
    clients: Option[];
    managers: Option[];
    statuses: Record<string, string>;
    types: Record<string, string>;
    submitLabel: string;
    cancelUrl: string;
}

const selectClass =
    'block w-full rounded-md border-line bg-white text-sm text-ink shadow-sm focus:border-accent focus:ring-accent/40';

export default function ProjectForm({
    data,
    setData,
    errors,
    processing,
    onSubmit,
    clients,
    managers,
    statuses,
    types,
    submitLabel,
    cancelUrl,
}: ProjectFormProps) {
    // Gyors megrendelő-felvétel (a teljes partnerkezelés a CRM modulban jön).
    const [clientOptions, setClientOptions] = useState<Option[]>(clients);
    const [quickOpen, setQuickOpen] = useState(false);
    const [quickName, setQuickName] = useState('');
    const [quickBusy, setQuickBusy] = useState(false);
    const [quickError, setQuickError] = useState<string | null>(null);

    const addQuickClient = async () => {
        if (!quickName.trim()) return;
        setQuickBusy(true);
        setQuickError(null);
        try {
            const res = await window.axios.post(route('projects.clients.quick'), {
                name: quickName.trim(),
            });
            const created: Option = res.data;
            setClientOptions((prev) =>
                [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'hu')),
            );
            setData('client_id', created.id);
            setQuickName('');
            setQuickOpen(false);
        } catch {
            setQuickError('Nem sikerült a megrendelő felvétele.');
        } finally {
            setQuickBusy(false);
        }
    };

    return (
        <form onSubmit={onSubmit} className="o-card max-w-3xl p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <InputLabel htmlFor="name" value="Projekt neve *" />
                    <TextInput
                        id="name"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        isFocused
                    />
                    <InputError message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="code" value="Azonosító *" />
                    <TextInput
                        id="code"
                        value={data.code}
                        onChange={(e) => setData('code', e.target.value)}
                        className="font-mono"
                    />
                    <InputError message={errors.code} />
                </div>

                <div>
                    <InputLabel htmlFor="status" value="Státusz *" />
                    <select
                        id="status"
                        value={data.status}
                        onChange={(e) => setData('status', e.target.value)}
                        className={selectClass}
                    >
                        {Object.entries(statuses).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.status} />
                </div>

                <div>
                    <InputLabel htmlFor="client" value="Megrendelő" />
                    <select
                        id="client"
                        value={data.client_id}
                        onChange={(e) =>
                            setData('client_id', e.target.value ? Number(e.target.value) : '')
                        }
                        className={selectClass}
                    >
                        <option value="">– Nincs kiválasztva –</option>
                        {clientOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.client_id} />

                    {!quickOpen ? (
                        <button
                            type="button"
                            onClick={() => setQuickOpen(true)}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-700"
                        >
                            <Plus size={13} />
                            Új megrendelő gyors felvétele
                        </button>
                    ) : (
                        <div className="mt-2 flex gap-2">
                            <TextInput
                                value={quickName}
                                onChange={(e) => setQuickName(e.target.value)}
                                placeholder="Megrendelő neve"
                                className="text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void addQuickClient();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => void addQuickClient()}
                                disabled={quickBusy}
                                className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
                            >
                                Felvesz
                            </button>
                        </div>
                    )}
                    {quickError && <p className="mt-1 text-xs text-coral">{quickError}</p>}
                </div>

                <div>
                    <InputLabel htmlFor="pm" value="Felelős projektvezető" />
                    <select
                        id="pm"
                        value={data.project_manager_id}
                        onChange={(e) =>
                            setData(
                                'project_manager_id',
                                e.target.value ? Number(e.target.value) : '',
                            )
                        }
                        className={selectClass}
                    >
                        <option value="">– Nincs kiválasztva –</option>
                        {managers.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.project_manager_id} />
                </div>

                <div>
                    <InputLabel htmlFor="type" value="Kivitelezés típusa" />
                    <select
                        id="type"
                        value={data.construction_type}
                        onChange={(e) => setData('construction_type', e.target.value)}
                        className={selectClass}
                    >
                        <option value="">– Nincs kiválasztva –</option>
                        {Object.entries(types).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.construction_type} />
                </div>

                <div>
                    <InputLabel htmlFor="city" value="Település" />
                    <TextInput
                        id="city"
                        value={data.location_city}
                        onChange={(e) => setData('location_city', e.target.value)}
                    />
                    <InputError message={errors.location_city} />
                </div>

                <div>
                    <InputLabel htmlFor="address" value="Cím / helyszín" />
                    <TextInput
                        id="address"
                        value={data.location_address}
                        onChange={(e) => setData('location_address', e.target.value)}
                    />
                    <InputError message={errors.location_address} />
                </div>

                <div>
                    <InputLabel htmlFor="starts_on" value="Kezdés" />
                    <TextInput
                        id="starts_on"
                        type="date"
                        value={data.starts_on}
                        onChange={(e) => setData('starts_on', e.target.value)}
                    />
                    <InputError message={errors.starts_on} />
                </div>

                <div>
                    <InputLabel htmlFor="ends_on" value="Tervezett befejezés" />
                    <TextInput
                        id="ends_on"
                        type="date"
                        value={data.ends_on}
                        onChange={(e) => setData('ends_on', e.target.value)}
                    />
                    <InputError message={errors.ends_on} />
                </div>

                <div className="sm:col-span-2">
                    <InputLabel htmlFor="description" value="Leírás" />
                    <textarea
                        id="description"
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        rows={4}
                        className="block w-full rounded-md border-line bg-white text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-accent focus:ring-accent/40"
                    />
                    <InputError message={errors.description} />
                </div>
            </div>

            <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                <button type="submit" className="btn-primary" disabled={processing}>
                    {submitLabel}
                </button>
                <Link href={cancelUrl} className="btn-ghost">
                    Mégse
                </Link>
            </div>
        </form>
    );
}
