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

export type DepType = 'bk' | 'kk' | 'bb' | 'kb';

export interface PhaseDependency {
    id: number;
    type: DepType;
    lag: number;
}

export type ResourceKind = 'kezi' | 'gepi';

export interface PhaseResource {
    id?: number;
    kind: ResourceKind;
    name: string;
    quantity: number;
    work_days: number;
    note: string | null;
}

export interface PhaseItem {
    id: number;
    seq: number;
    name: string;
    sort_order: number;
    starts_on: string | null;
    due_on: string | null;
    work_days: number | null;
    progress: number;
    note: string | null;
    is_overdue: boolean;
    depends_on: number[];
    dependencies: PhaseDependency[];
    resources: PhaseResource[];
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

export interface FolderCrumb {
    id: number | null;
    name: string;
}

export interface TreeFolder {
    id: number;
    name: string;
    parent_id: number | null;
    is_restricted: boolean;
    can_edit: boolean;
}

export interface AclEntry {
    user_id: number;
    access: 'view' | 'edit';
}

export interface ExplorerFolderRow {
    id: number;
    name: string;
    is_restricted: boolean;
    items_count: number;
    updated_at: string;
    acl: AclEntry[];
    can_manage_permissions: boolean;
}

export interface ExplorerFileRow {
    id: number;
    title: string;
    category: string;
    original_filename: string | null;
    mime_type: string | null;
    size_bytes: number;
    version_number: number;
    updated_at: string;
    download_version_id: number | null;
    preview_version_id: number | null;
    is_image: boolean;
    project_code: string | null;
    location: string | null;
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

export interface TaskAttachment {
    id: number;
    name: string;
    size: number;
    is_image: boolean;
    url: string;
}

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
    creator: Option | null;
    created_at: string;
    can_move: boolean;
    completed_at: string | null;
    attachments: TaskAttachment[];
}

export interface ProjectOption {
    id: number;
    label: string;
}

export interface ProjectRef {
    id: number;
    code: string;
    name: string;
}

export type CalendarEventType = 'beosztas' | 'szallitas' | 'esemeny' | 'szemelyes';

export interface CalendarEventItem {
    id: number;
    title: string;
    type: CalendarEventType;
    project: ProjectRef | null;
    starts_on: string;
    ends_on: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    note: string | null;
    assignees: Option[];
    creator_name: string | null;
    can_manage: boolean;
    is_conflicted: boolean;
}

export interface MilestoneItem {
    key: string;
    date: string;
    label: string;
    kind: 'fazis' | 'atadas';
    done: boolean;
    project: ProjectRef | null;
}

export interface TaskDueItem {
    key: string;
    id: number;
    date: string;
    label: string;
    done: boolean;
    overdue: boolean;
    project: ProjectRef | null;
}

export interface PartnerListItem {
    id: number;
    name: string;
    is_company: boolean;
    is_client: boolean;
    is_supplier: boolean;
    is_subcontractor: boolean;
    roles: string[];
    source: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    projects_count: number;
}

export interface PartnerDetail extends PartnerListItem {
    tax_id: string | null;
    address: string | null;
    note: string | null;
    created_at: string | null;
}

export interface PartnerProjectRow {
    id: number;
    code: string;
    name: string;
    status: ProjectStatus;
    pm_name: string | null;
    starts_on: string | null;
    ends_on: string | null;
}

export interface ManagedUser {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    job_title: string | null;
    initials: string;
    is_active: boolean;
    is_external: boolean;
    role: string | null;
    two_factor_enabled: boolean;
    is_self: boolean;
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
