import { Link } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
    Search,
    Bell,
    Plus,
    Menu as MenuIcon,
    LogOut,
    ChevronDown,
    UserCircle,
} from 'lucide-react';
import { usePageProps } from '@/hooks/usePageProps';

export default function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
    const { auth } = usePageProps();
    const user = auth.user;
    const canCreateProject = auth.permissions.includes('projects.create');

    return (
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-cream/85 px-4 backdrop-blur">
            {/* Mobile menu button */}
            <button
                type="button"
                onClick={onOpenSidebar}
                className="rounded-lg p-2 text-ink-soft hover:bg-white lg:hidden"
                aria-label="Menü megnyitása"
            >
                <MenuIcon size={20} />
            </button>

            {/* Search */}
            <div className="relative hidden max-w-md flex-1 sm:block">
                <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                    type="search"
                    placeholder="Keresés projektekben, partnerekben…"
                    className="w-full rounded-lg border-line bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-accent/30"
                />
            </div>

            <div className="ml-auto flex items-center gap-2">
                {canCreateProject && (
                    <Link
                        href={route('projects.index')}
                        className="btn-primary hidden px-3 py-2 sm:inline-flex"
                    >
                        <Plus size={16} />
                        <span>Új projekt</span>
                    </Link>
                )}

                {/* Notifications */}
                <button
                    type="button"
                    className="relative rounded-lg p-2 text-ink-soft hover:bg-white"
                    aria-label="Értesítések"
                >
                    <Bell size={19} />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral" />
                </button>

                {/* Profile menu */}
                <Menu as="div" className="relative">
                    <MenuButton className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-white">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white">
                            {user?.initials ?? 'U'}
                        </span>
                        <span className="hidden text-left leading-tight md:block">
                            <span className="block text-sm font-medium text-ink">
                                {user?.name}
                            </span>
                            {user?.job_title && (
                                <span className="block text-xs text-ink-faint">
                                    {user.job_title}
                                </span>
                            )}
                        </span>
                        <ChevronDown size={16} className="text-ink-faint" />
                    </MenuButton>

                    <MenuItems className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-line bg-white p-1 shadow-lg focus:outline-none">
                        <div className="px-3 py-2">
                            <div className="text-sm font-medium text-ink">{user?.name}</div>
                            <div className="truncate text-xs text-ink-faint">{user?.email}</div>
                        </div>
                        <div className="my-1 h-px bg-line" />
                        <MenuItem>
                            {({ focus }) => (
                                <Link
                                    href={route('profile.edit')}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                                        focus ? 'bg-cream text-ink' : 'text-ink-soft'
                                    }`}
                                >
                                    <UserCircle size={16} />
                                    Profil és biztonság
                                </Link>
                            )}
                        </MenuItem>
                        <MenuItem>
                            {({ focus }) => (
                                <Link
                                    as="button"
                                    method="post"
                                    href="/logout"
                                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                                        focus ? 'bg-cream text-coral' : 'text-ink-soft'
                                    }`}
                                >
                                    <LogOut size={16} />
                                    Kijelentkezés
                                </Link>
                            )}
                        </MenuItem>
                    </MenuItems>
                </Menu>
            </div>
        </header>
    );
}
