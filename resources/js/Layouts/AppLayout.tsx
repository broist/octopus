import { PropsWithChildren, useEffect, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import Sidebar from '@/Components/Sidebar';
import Topbar from '@/Components/Topbar';
import FlashBanner from '@/Components/FlashBanner';

export default function AppLayout({ children }: PropsWithChildren) {
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close the mobile drawer whenever the viewport grows to desktop.
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const handler = () => mq.matches && setMobileOpen(false);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-cream">
            {/* Desktop sidebar */}
            <aside className="hidden w-64 shrink-0 lg:block">
                <Sidebar />
            </aside>

            {/* Mobile drawer */}
            <Dialog
                open={mobileOpen}
                onClose={setMobileOpen}
                className="relative z-40 lg:hidden"
            >
                <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                <div className="fixed inset-0 flex">
                    <DialogPanel className="w-64 max-w-[80%]">
                        <Sidebar onNavigate={() => setMobileOpen(false)} />
                    </DialogPanel>
                </div>
            </Dialog>

            {/* Main column */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <Topbar onOpenSidebar={() => setMobileOpen(true)} />
                <main className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                        <FlashBanner />
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
