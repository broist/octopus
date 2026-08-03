import { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
    return (
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-sidebar sm:text-2xl">
                    {title}
                </h1>
                {/* A magyarázó sor telefonon csak helyet venne el a tartalomtól. */}
                {subtitle && (
                    <p className="mt-1 hidden text-sm text-ink-soft sm:block">{subtitle}</p>
                )}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
            )}
        </div>
    );
}
