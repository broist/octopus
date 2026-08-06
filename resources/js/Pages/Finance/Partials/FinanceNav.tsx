import { Link } from '@inertiajs/react';
import { FolderKanban, PiggyBank } from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { usePageProps } from '@/hooks/usePageProps';

type FinanceTab = 'projects' | 'ledger';

const TABS: { key: FinanceTab; label: string; route: string; icon: LucideIcon; ability?: string }[] = [
    { key: 'projects', label: 'Projektek', route: 'finance.index', icon: FolderKanban },
    { key: 'ledger', label: 'Tagi kölcsön', route: 'finance.ledger', icon: PiggyBank },
];

/**
 * Fül-almenü a Pénzügy modul két nézete között. A tagi kölcsön nyilvántartás
 * tulajdonosi adat, ezért a fül csak annak jelenik meg, aki a bal oldali
 * menüben is látja (a nav-ból derül ki, hogy megkapta-e a jogot).
 */
export default function FinanceNav({ active }: { active: FinanceTab }) {
    const { nav } = usePageProps();
    const financeChildren = nav.find((item) => item.key === 'finance')?.children ?? [];
    const canSeeLedger = financeChildren.some((child) => child.key === 'finance.ledger');

    const tabs = TABS.filter((t) => t.key !== 'ledger' || canSeeLedger);

    if (tabs.length < 2) {
        return null;
    }

    return (
        <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
            {tabs.map((t) => {
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
