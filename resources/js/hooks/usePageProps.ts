import { usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';

/**
 * Typed accessor for Inertia shared props + the current page's own props.
 */
export function usePageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
>() {
    return usePage<PageProps<T>>().props;
}
