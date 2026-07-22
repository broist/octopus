import { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
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

/** A modul (és almenüi) valamelyikén állunk-e éppen. */
function moduleIsActive(item: NavItem, path: string): boolean {
    if (isActive(item.route)) {
        return true;
    }
    // Az almenük mind az adott modul útvonalprefixére mutatnak (pl. /ajanlatok).
    const base = '/' + item.key.replace(/\..*$/, '');
    return path === base || path.startsWith(base + '/');
}

function childHref(child: NavItem['children'][number]): string {
    try {
        return child.tab ? route(child.route, child.tab) : route(child.route);
    } catch {
        return '#';
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
                active ? 'beam-active text-white' : 'text-white/70 hover:text-white',
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

function NavGroupWithChildren({
    item,
    path,
    onNavigate,
}: {
    item: NavItem;
    path: string;
    onNavigate?: () => void;
}) {
    const Icon = moduleIcon(item.icon);
    const parentActive = moduleIsActive(item, path);
    const [open, setOpen] = useState(parentActive);

    const currentTab = (() => {
        try {
            return new URL(window.location.href).searchParams.get('tab');
        } catch {
            return null;
        }
    })();

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={clsx(
                    'beam group flex w-full items-center gap-3 px-3 py-2 text-sm font-medium',
                    parentActive ? 'beam-active text-white' : 'text-white/70 hover:text-white',
                )}
            >
                <Icon
                    size={18}
                    className={clsx(
                        parentActive ? 'text-white' : 'text-white/60 group-hover:text-white/90',
                    )}
                />
                <span className="flex-1 truncate text-left">{item.label}</span>
                <ChevronDown
                    size={15}
                    className={clsx(
                        'shrink-0 text-white/50 transition-transform',
                        open && 'rotate-180',
                    )}
                />
            </button>

            {open && (
                <div className="mt-1 space-y-0.5 pl-4">
                    {item.children.map((child) => {
                        const active = child.tab
                            ? path.startsWith('/ajanlatok/') && currentTab === child.tab
                            : isActive(child.route) && !currentTab;
                        return (
                            <Link
                                key={child.key}
                                href={childHref(child)}
                                onClick={onNavigate}
                                className={clsx(
                                    'flex items-center gap-2.5 rounded-sm py-1.5 pl-3 pr-2 text-[13px]',
                                    active
                                        ? 'bg-white/10 font-medium text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                <span
                                    className={clsx(
                                        'h-1.5 w-1.5 shrink-0 rounded-full',
                                        active ? 'bg-accent' : 'bg-white/25',
                                    )}
                                />
                                <span className="truncate">{child.label}</span>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    const { nav } = usePageProps();
    const { url } = usePage();
    const path = url.split('?')[0];

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
                            {items.map((item) =>
                                item.children.length > 0 ? (
                                    <NavGroupWithChildren
                                        key={item.key}
                                        item={item}
                                        path={path}
                                        onNavigate={onNavigate}
                                    />
                                ) : (
                                    <NavLink key={item.key} item={item} onNavigate={onNavigate} />
                                ),
                            )}
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
