import { Link } from '@inertiajs/react';
import { ClipboardCheck, ListChecks, ShieldAlert, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

type QaTab = 'defects' | 'inspections' | 'templates' | 'safety';

const TABS: { key: QaTab; label: string; route: string; icon: LucideIcon }[] = [
    { key: 'defects', label: 'Hibalisták', route: 'qa.index', icon: TriangleAlert },
    { key: 'inspections', label: 'Ellenőrzések', route: 'qa.inspections.index', icon: ClipboardCheck },
    { key: 'templates', label: 'Sablonok', route: 'qa.templates.index', icon: ListChecks },
    { key: 'safety', label: 'Munkavédelem', route: 'qa.safety.index', icon: ShieldAlert },
];

export default function QaNav({ active }: { active: QaTab }) {
    return (
        <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
            {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = t.key === active;
                return (
                    <Link
                        key={t.key}
                        href={route(t.route)}
                        className={clsx(
                            '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition',
                            isActive
                                ? 'border-accent text-accent'
                                : 'border-transparent text-ink-soft hover:text-ink',
                        )}
                    >
                        <Icon size={15} />
                        {t.label}
                    </Link>
                );
            })}
        </div>
    );
}
