import { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import { Hammer } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import { moduleIcon } from '@/lib/icons';

interface PlaceholderProps {
    module: {
        key: string;
        label: string;
        icon: string;
    };
}

export default function Placeholder({ module }: PlaceholderProps) {
    const Icon = moduleIcon(module.icon);

    return (
        <>
            <Head title={module.label} />

            <PageHeader title={module.label} />

            <div className="o-card flex flex-col items-center justify-center px-6 py-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50 text-accent">
                    <Icon size={30} />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-sidebar">
                    Ez a modul hamarosan elkészül
                </h2>
                <p className="mt-2 max-w-md text-sm text-ink-soft">
                    A(z) <span className="font-medium">{module.label}</span> modul
                    fejlesztés alatt áll. A rendszer a specifikáció sorrendjében épül fel,
                    modulról modulra.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amberwarn/10 px-3 py-1 text-xs font-medium text-[#8a5e17]">
                    <Hammer size={14} />
                    Fejlesztés alatt
                </div>
            </div>
        </>
    );
}

Placeholder.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
