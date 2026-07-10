import { ReactNode } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: ReactNode;
    icon?: LucideIcon;
    hint?: string;
    tone?: 'default' | 'coral' | 'amber' | 'green';
}

const toneRing: Record<NonNullable<StatCardProps['tone']>, string> = {
    default: 'text-accent bg-accent-50',
    green: 'text-accent bg-accent-50',
    coral: 'text-coral bg-coral/10',
    amber: 'text-amberwarn bg-amberwarn/10',
};

export default function StatCard({
    label,
    value,
    icon: Icon,
    hint,
    tone = 'default',
}: StatCardProps) {
    return (
        <div className="o-card flex items-start justify-between p-5">
            <div>
                <div className="text-sm font-medium text-ink-soft">{label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-sidebar">
                    {value}
                </div>
                {hint && <div className="mt-1 text-xs text-ink-faint">{hint}</div>}
            </div>
            {Icon && (
                <span
                    className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        toneRing[tone],
                    )}
                >
                    <Icon size={20} />
                </span>
            )}
        </div>
    );
}
