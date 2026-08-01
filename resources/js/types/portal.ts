/**
 * Az ügyfélportál felületének típusai. Szándékosan szűk: csak az kerül ide,
 * amit a megrendelő is lát — költség, árrés és belső jegyzet nincs köztük.
 */

import type { WeatherSnapshot } from '@/types/models';

export interface PortalPartner {
    id: number;
    name: string;
}

export interface PortalManager {
    name: string;
    email: string | null;
    phone: string | null;
    job_title: string | null;
}

export interface PortalProjectRow {
    id: number;
    code: string;
    name: string;
    status: string;
    status_label: string;
    progress: number;
    starts_on: string | null;
    ends_on: string | null;
    location: string | null;
    manager: PortalManager | null;
    documents_count: number;
    reports_count: number;
    open_quotes_count: number;
    updated_at: string;
}

export interface PortalProject {
    id: number;
    code: string;
    name: string;
    status: string;
    status_label: string;
    progress: number;
    starts_on: string | null;
    ends_on: string | null;
    location: string | null;
    summary: string | null;
    manager: PortalManager | null;
}

export interface PortalPhase {
    id: number;
    level: number;
    name: string;
    is_group: boolean;
    is_milestone: boolean;
    starts_on: string | null;
    due_on: string | null;
    progress: number;
}

export interface PortalDocument {
    id: number;
    title: string;
    category: string;
    category_label: string;
    filename: string;
    size_bytes: number;
    previewable: boolean;
    version_id: number;
    updated_at: string;
}

export interface PortalPhoto {
    id: number;
    url: string;
    filename: string;
}

export interface PortalReport {
    id: number;
    report_date: string;
    work_done: string | null;
    weather: WeatherSnapshot | null;
    photos: PortalPhoto[];
}

export interface PortalQuote {
    id: number;
    quote_number: string | null;
    title: string;
    net_offer: number;
    gross_offer: number;
    version: number;
    is_final: boolean;
    response: string | null;
    response_label: string | null;
    response_note: string | null;
    responded_at: string | null;
    valid_until: string | null;
    updated_at: string;
}
