import { ReactNode } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { ListTree } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import ProjectForm, { ProjectFormData } from '@/Pages/Projects/Partials/ProjectForm';
import { usePageProps } from '@/hooks/usePageProps';
import type { Option } from '@/types/models';

interface CreateProps extends Record<string, unknown> {
    clients: Option[];
    managers: Option[];
    statuses: Record<string, string>;
    types: Record<string, string>;
    suggestedCode: string;
    parent: {
        id: number;
        code: string;
        name: string;
        client_id: number | null;
        project_manager_id: number | null;
        status: string;
    } | null;
}

export default function Create() {
    const { clients, managers, statuses, types, suggestedCode, parent } =
        usePageProps<CreateProps>();

    const form = useForm<ProjectFormData>({
        parent_id: parent?.id ?? null,
        name: '',
        code: suggestedCode,
        status: parent?.status ?? 'ajanlat',
        construction_type: '',
        client_id: parent?.client_id ?? '',
        project_manager_id: parent?.project_manager_id ?? '',
        location_city: '',
        location_address: '',
        starts_on: '',
        ends_on: '',
        description: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('projects.store'));
    };

    return (
        <>
            <Head title={parent ? 'Új alprojekt' : 'Új projekt'} />

            <PageHeader
                title={parent ? 'Új alprojekt' : 'Új projekt'}
                subtitle={
                    parent
                        ? undefined
                        : 'Adja meg az új munka törzsadatait – a részletek később is bővíthetők.'
                }
            />

            {parent && (
                <div className="mb-5 flex max-w-3xl items-center gap-2 rounded-card border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-700">
                    <ListTree size={16} />
                    <span>
                        Főprojekt: <span className="font-medium">{parent.name}</span>{' '}
                        <span className="font-mono text-xs">({parent.code})</span> — az alprojekt
                        örökli a megrendelőt és a projektvezetőt, de átírható.
                    </span>
                </div>
            )}

            <ProjectForm
                data={form.data}
                setData={form.setData}
                errors={form.errors}
                processing={form.processing}
                onSubmit={submit}
                clients={clients}
                managers={managers}
                statuses={statuses}
                types={types}
                submitLabel={parent ? 'Alprojekt létrehozása' : 'Projekt létrehozása'}
                cancelUrl={parent ? route('projects.show', parent.id) : route('projects.index')}
            />
        </>
    );
}

Create.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
