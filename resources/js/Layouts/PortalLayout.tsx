import { PropsWithChildren } from 'react';
import { Link } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ChevronDown, LogOut, UserCircle } from 'lucide-react';
import FlashBanner from '@/Components/FlashBanner';
import { usePageProps } from '@/hooks/usePageProps';

/**
 * Az ügyfélportál kerete.
 *
 * Szándékosan más, mint a belső app: nincs modulmenü és nincs oldalsáv — a
 * megrendelőnek egyetlen, egyszerű felület jár. A fejlécben csak a márka, a
 * cégneve és a saját fiókja látszik.
 */
export default function PortalLayout({ children }: PropsWithChildren) {
    const props = usePageProps<{ partner?: { id: number; name: string } }>();
    const { auth } = props;
    const partnerName = props.partner?.name;

    return (
        <div className="flex min-h-screen flex-col bg-cream">
            <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
                    <Link href={route('ugyfel.index')} className="flex items-center gap-3">
                        <img
                            src="/octopus-mark.png"
                            alt="Octopus"
                            className="h-9 w-9 object-contain"
                        />
                        <span className="leading-tight">
                            <span className="block text-base font-semibold tracking-wide text-sidebar">
                                OCTOPUS
                            </span>
                            <span className="block text-[10px] font-medium uppercase tracking-[0.28em] text-accent">
                                AcuWall
                            </span>
                        </span>
                    </Link>

                    <div className="ml-auto flex items-center gap-3">
                        {partnerName && (
                            <span className="hidden text-sm text-ink-soft sm:block">
                                {partnerName}
                            </span>
                        )}

                        <Menu as="div" className="relative">
                            <MenuButton className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-white">
                                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-semibold text-white">
                                    {auth.user?.initials ?? 'U'}
                                </span>
                                <ChevronDown size={16} className="text-ink-faint" />
                            </MenuButton>

                            <MenuItems className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-line bg-white p-1 shadow-lg focus:outline-none">
                                <div className="px-3 py-2">
                                    <div className="text-sm font-medium text-ink">
                                        {auth.user?.name}
                                    </div>
                                    <div className="truncate text-xs text-ink-faint">
                                        {auth.user?.email}
                                    </div>
                                </div>
                                <div className="my-1 h-px bg-line" />
                                <MenuItem>
                                    {({ focus }) => (
                                        <Link
                                            href={route('ugyfel.fiok')}
                                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                                                focus ? 'bg-cream text-ink' : 'text-ink-soft'
                                            }`}
                                        >
                                            <UserCircle size={16} />
                                            Fiók és jelszó
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
                </div>
            </header>

            <main className="flex-1">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
                    <FlashBanner />
                    {children}
                </div>
            </main>

            <footer className="border-t border-line px-4 py-4 text-center text-xs text-ink-faint">
                © {new Date().getFullYear()} AcuWall · Octopus ügyfélportál
            </footer>
        </div>
    );
}
