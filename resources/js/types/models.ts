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

// --- Alvállalkozók (5. modul) ---

export interface SubcontractorListItem {
    id: number;
    name: string;
    is_company: boolean;
    trade: string | null;
    trade_label: string | null;
    crew_size: number | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    avg_rating: number | null;
    expiring_count: number;
}

export interface SubcontractorDetail extends SubcontractorListItem {
    tax_id: string | null;
    address: string | null;
    availability_note: string | null;
    note: string | null;
    created_at: string | null;
}

export type CertStatus = 'ok' | 'soon' | 'expired';

export interface SubCertification {
    id: number;
    type: string;
    type_label: string;
    name: string;
    issuer: string | null;
    valid_from: string | null;
    valid_until: string | null;
    note: string | null;
    status: CertStatus;
    has_file: boolean;
    file_name: string | null;
    download_url: string | null;
}

export interface SubRating {
    id: number;
    score: number;
    comment: string | null;
    project: { id: number; code: string; name: string } | null;
    rater_name: string | null;
    created_at: string | null;
}

export interface SubDocument {
    id: number;
    category: string;
    category_label: string;
    name: string;
    size_bytes: number;
    uploader_name: string | null;
    created_at: string | null;
    download_url: string;
}

export interface SubAssignedProject {
    id: number;
    code: string;
    name: string;
    status: ProjectStatus;
    pivot_id: number;
    scope: string | null;
    note: string | null;
}

// --- Munkatársak / Erőforrások (6. modul) ---

export interface StaffListItem {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    job_title: string | null;
    initials: string;
    is_active: boolean;
    role: string | null;
    expiring_count: number;
    on_leave: boolean;
}

export interface StaffDetail extends StaffListItem {
    hired_on: string | null;
    created_at: string | null;
}

export interface StaffQualification {
    id: number;
    type: string;
    type_label: string;
    name: string;
    issuer: string | null;
    valid_from: string | null;
    valid_until: string | null;
    note: string | null;
    status: CertStatus;
    has_file: boolean;
    file_name: string | null;
    download_url: string | null;
}

export interface StaffWorkLog {
    id: number;
    work_date: string;
    hours: number;
    note: string | null;
    project: { id: number; code: string; name: string } | null;
}

export interface StaffHoursByProject {
    project: { id: number; code: string; name: string } | null;
    hours: number;
}

export interface StaffAbsence {
    id: number;
    type: string;
    type_label: string;
    starts_on: string;
    ends_on: string;
    note: string | null;
    is_current: boolean;
    is_future: boolean;
}

/** Szabadság a naptár csak-olvasható rétegében. */
export interface AbsenceCalItem {
    key: string;
    user_id: number;
    user_name: string | null;
    type: string;
    type_label: string;
    starts_on: string;
    ends_on: string;
}

// --- Gépek és eszközök (7. modul) ---

export interface MachineListItem {
    id: number;
    name: string;
    kind: string | null;
    kind_label: string | null;
    identifier: string | null;
    status: string;
    status_label: string;
    ownership: string;
    location: string | null;
    responsible_name: string | null;
    next_service_on: string | null;
    inspection_valid_until: string | null;
    service_status: CertStatus;
    inspection_status: CertStatus;
    booked_today: boolean;
}

export interface MachineDetail extends MachineListItem {
    manufacture_year: number | null;
    purchased_on: string | null;
    ownership_label: string;
    rental_source: string | null;
    responsible_user_id: number | null;
    note: string | null;
    created_at: string | null;
}

export interface MachineMaintenance {
    id: number;
    type: string;
    type_label: string;
    performed_on: string | null;
    description: string;
    cost: number | null;
    has_file: boolean;
    file_name: string | null;
    download_url: string | null;
    creator_name: string | null;
}

export interface MachineDocument {
    id: number;
    category: string;
    category_label: string;
    name: string;
    size_bytes: number;
    uploader_name: string | null;
    created_at: string | null;
    download_url: string;
}

export interface MachineBooking {
    id: number;
    starts_on: string;
    ends_on: string;
    note: string | null;
    is_current: boolean;
    is_conflicted: boolean;
    project: { id: number; code: string; name: string; status: ProjectStatus } | null;
}

/** Gépfoglalás a naptár csak-olvasható rétegében. */
export interface MachineBookingCalItem {
    key: string;
    machine_id: number;
    machine_name: string | null;
    starts_on: string;
    ends_on: string;
    is_conflicted: boolean;
    project: ProjectRef | null;
}

// --- Anyagok / Készlet (8. modul) ---

export type ProcurementStatus = 'tervezett' | 'megrendelve' | 'beerkezett';

export interface MaterialOption {
    id: number;
    name: string;
    unit: string;
    unit_label: string;
    category_label: string | null;
}

export interface MaterialCatalogItem {
    id: number;
    name: string;
    category: string | null;
    category_label: string | null;
    unit: string;
    unit_label: string;
    sku: string | null;
    note: string | null;
    procurements_count: number;
}

export interface ProcurementMaterialRef {
    id: number;
    name: string;
    unit: string;
    unit_label: string;
    category_label: string | null;
}

export interface ProcurementItem {
    id: number;
    material: ProcurementMaterialRef | null;
    project: ProjectRef | null;
    supplier_id: number | null;
    supplier_name: string | null;
    status: ProcurementStatus;
    status_label: string;
    quantity: number;
    unit_price: number | null;
    line_value: number | null;
    ordered_on: string | null;
    expected_on: string | null;
    received_on: string | null;
    received_quantity: number | null;
    note: string | null;
}

/** Anyagszállítás / beérkezés a naptár csak-olvasható rétegében. */
export interface DeliveryCalItem {
    key: string;
    date: string;
    material_name: string | null;
    quantity: number;
    unit_label: string | null;
    received: boolean;
    project: ProjectRef | null;
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
