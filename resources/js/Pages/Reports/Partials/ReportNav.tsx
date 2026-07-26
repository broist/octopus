import { Link } from '@inertiajs/react';
import {
    BarChart3,
    CalendarClock,
    HardHat,
    Receipt,
    ShieldCheck,
    TrendingUp,
    Users,
    Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
    nyeresegesseg: TrendingUp,
    csuszas: CalendarClock,
    koltseg: Wallet,
    eroforras: Users,
    alvallalkozo: HardHat,
    kifizetes: Receipt,
    minoseg: ShieldCheck,
    idoszaki: BarChart3,
};

interface Tab {
    key: string;
    label: string;
    title: string;
}

export default function ReportNav({ tabs, active }: { tabs: Tab[]; active: string }) {
    return (
        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
            {tabs.map((tab) => {
                const Icon = ICONS[tab.key] ?? BarChart3;
                const isActive = tab.key === active;
                return (
                    <Link
                        key={tab.key}
                        href={route('reports.show', tab.key)}
                        title={tab.title}
                        className={clsx(
                            '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition',
                            isActive
                                ? 'border-accent text-accent'
                                : 'border-transparent text-ink-soft hover:text-ink',
                        )}
                    >
                        <Icon size={15} />
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
