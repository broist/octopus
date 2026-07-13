import { ReactNode } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import ProjectForm, { ProjectFormData } from '@/Pages/Projects/Partials/ProjectForm';
import { usePageProps } from '@/hooks/usePageProps';
import type { Option } from '@/types/models';

interface EditProps extends Record<string, unknown> {
    clients: Option[];
    managers: Option[];
    statuses: Record<string, string>;
    types: Record<string, string>;
    project: {
        id: number;
        parent_id: number | null;
        code: string;
        name: string;
        status: string;
        construction_type: string | null;
        client_id: number | null;
        project_manager_id: number | null;
        location_city: string | null;
        location_address: string | null;
        starts_on: string | null;
        ends_on: string | null;
        description: string | null;
    };
}

export default function Edit() {
    const { clients, managers, statuses, types, project } = usePageProps<EditProps>();

    const form = useForm<ProjectFormData>({
        parent_id: project.parent_id,
        name: project.name,
        code: project.code,
        status: project.status,
        construction_type: project.construction_type ?? '',
        client_id: project.client_id ?? '',
        project_manager_id: project.project_manager_id ?? '',
        location_city: project.location_city ?? '',
        location_address: project.location_address ?? '',
        starts_on: project.starts_on ?? '',
        ends_on: project.ends_on ?? '',
        description: project.description ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(route('projects.update', project.id));
    };

    return (
        <>
            <Head title={`Szerkesztés – ${project.name}`} />

            <PageHeader
                title="Projekt szerkesztése"
                subtitle={`${project.code} · ${project.name}`}
            />

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
                submitLabel="Módosítások mentése"
                cancelUrl={route('projects.show', project.id)}
            />
        </>
    );
}

Edit.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
