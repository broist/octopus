import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import AppLogo from '@/Components/AppLogo';
import { moduleIcon } from '@/lib/icons';
import { usePageProps } from '@/hooks/usePageProps';
import type { NavItem } from '@/types';

const GROUPS: { key: string; label: string | null }[] = [
    { key: 'main', label: null },
    { key: 'partners', label: 'Partnerek' },
    { key: 'resources', label: 'Erőforrások' },
    { key: 'operations', label: 'Működés' },
    { key: 'insights', label: 'Kimutatások' },
    { key: 'admin', label: 'Adminisztráció' },
];

function isActive(routeName: string): boolean {
    try {
        return Boolean(route().current(routeName));
    } catch {
        return false;
    }
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
    const Icon = moduleIcon(item.icon);
    const active = isActive(item.route);

    return (
        <Link
            href={route(item.route)}
            onClick={onNavigate}
            className={clsx(
                'beam group flex items-center gap-3 px-3 py-2 text-sm font-medium',
                active
                    ? 'beam-active text-white'
                    : 'text-white/70 hover:text-white',
            )}
        >
            <Icon
                size={18}
                className={clsx(active ? 'text-white' : 'text-white/60 group-hover:text-white/90')}
            />
            <span className="truncate">{item.label}</span>
        </Link>
    );
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    const { nav } = usePageProps();

    return (
        <div className="flex h-full flex-col bg-sidebar">
            {/* Brand */}
            <div className="flex h-16 items-center border-b border-white/10 px-5">
                <AppLogo light />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                {GROUPS.map((group) => {
                    const items = nav.filter((item) => item.group === group.key);
                    if (items.length === 0) {
                        return null;
                    }

                    return (
                        <div key={group.key} className="space-y-1">
                            {group.label && (
                                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                    {group.label}
                                </div>
                            )}
                            {items.map((item) => (
                                <NavLink key={item.key} item={item} onNavigate={onNavigate} />
                            ))}
                        </div>
                    );
                })}
            </nav>

            <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/35">
                © {new Date().getFullYear()} Octopus
            </div>
        </div>
    );
}
