/** Laravel paginátor (paginate() alap szerializáció). */
export interface Paginator<T> {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    total: number;
    from: number | null;
    to: number | null;
}

export interface Option {
    id: number;
    name: string;
}

export type ProjectStatus = 'ajanlat' | 'szerzodott' | 'folyamatban' | 'atadas' | 'lezart';

export interface ProjectListItem {
    id: number;
    code: string;
    name: string;
    status: ProjectStatus;
    client_name: string | null;
    pm_name: string | null;
    starts_on: string | null;
    ends_on: string | null;
    progress: number;
    subprojects_count: number;
    phases_count: number;
    is_slipping: boolean;
}

export interface PhaseItem {
    id: number;
    name: string;
    sort_order: number;
    starts_on: string | null;
    due_on: string | null;
    progress: number;
    note: string | null;
    is_overdue: boolean;
    depends_on: number[];
}

export interface SubprojectItem {
    id: number;
    code: string;
    name: string;
    status: ProjectStatus;
    progress: number;
    phases_count: number;
    is_slipping: boolean;
}

export interface ActivityItem {
    id: number;
    type: string;
    description: string;
    user_name: string | null;
    created_at: string;
}

export interface DocumentRow {
    id: number;
    title: string;
    category: string;
    project: { id: number; code: string } | null;
    partner_name: string | null;
    uploader_name: string | null;
    updated_at: string;
    version_number: number;
    original_filename: string | null;
    mime_type: string | null;
    size_bytes: number;
    download_version_id: number | null;
}

export interface DocumentVersionRow {
    id: number;
    version_number: number;
    is_current: boolean;
    original_filename: string;
    mime_type: string | null;
    size_bytes: number;
    note: string | null;
    uploader_name: string | null;
    created_at: string;
    stored_in_cloud: boolean;
}

export interface ProjectDocumentRow {
    id: number;
    title: string;
    category: string;
    version_number: number;
    original_filename: string | null;
    size_bytes: number;
    download_version_id: number | null;
    uploader_name: string | null;
    updated_at: string;
}

export type TaskStatus = 'teendo' | 'folyamatban' | 'kesz';
export type TaskPriority = 'alacsony' | 'kozepes' | 'magas';

export interface TaskItem {
    id: number;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_on: string | null;
    is_overdue: boolean;
    project: { id: number; code: string; name: string } | null;
    assignees: Option[];
    can_move: boolean;
    completed_at: string | null;
}

export interface ProjectOption {
    id: number;
    label: string;
}

export interface ProjectDetail {
    id: number;
    code: string;
    name: string;
    status: ProjectStatus;
    construction_type: string | null;
    client: Option | null;
    project_manager: Option | null;
    parent: { id: number; code: string; name: string } | null;
    location_city: string | null;
    location_address: string | null;
    starts_on: string | null;
    ends_on: string | null;
    description: string | null;
    progress: number;
    is_slipping: boolean;
}
