import { route as routeFn } from 'ziggy-js';
import { PageProps as InertiaPageProps } from '@inertiajs/core';

declare global {
    // Ziggy route() helper, available globally.
    // eslint-disable-next-line no-var
    var route: typeof routeFn;

    interface Window {
        route: typeof routeFn;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Ziggy: any;
    }
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    initials: string;
    phone: string | null;
    job_title: string | null;
    avatar_path: string | null;
    is_external: boolean;
    two_factor_enabled: boolean;
}

export interface FlashMessages {
    success?: string | null;
    error?: string | null;
    info?: string | null;
}

export interface NavItem {
    key: string;
    label: string;
    route: string;
    icon: string;
    group: string;
}

export interface SharedProps {
    app: {
        name: string;
        locale: string;
    };
    auth: {
        user: AuthUser | null;
        roles: string[];
        permissions: string[];
    };
    flash: FlashMessages;
    nav: NavItem[];
}

export type PageProps<T extends Record<string, unknown> = Record<string, unknown>> =
    T & SharedProps & InertiaPageProps;
