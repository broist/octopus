import { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import { FolderKanban, CalendarClock, ListChecks, TriangleAlert } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import { usePageProps } from '@/hooks/usePageProps';

function EmptyPanel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="o-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
                {title}
            </h2>
            <div className="mt-4 rounded-lg border border-dashed border-line bg-cream/60 px-4 py-8 text-center text-sm text-ink-faint">
                {children}
            </div>
        </section>
    );
}

export default function Dashboard() {
    const { auth } = usePageProps();
    const firstName = auth.user?.name?.split(' ')[0] ?? '';

    return (
        <>
            <Head title="Vezérlőpult" />

            <PageHeader
                title={`Üdv, ${firstName}!`}
                subtitle="Áttekintés a folyamatban lévő munkákról és a napi teendőkről."
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Aktív projektek" value="—" icon={FolderKanban} hint="A Projektek modul készültével él" />
                <StatCard label="Közelgő határidők" value="—" icon={CalendarClock} tone="amber" hint="Naptár + mérföldkövek" />
                <StatCard label="Nyitott feladatok" value="—" icon={ListChecks} tone="green" hint="A Feladatok modulból" />
                <StatCard label="Riasztások" value="—" icon={TriangleAlert} tone="coral" hint="Csúszás, hiányzó anyag, lejáró doksik" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    <EmptyPanel title="Mai nap">
                        Ki hol dolgozik ma, mely alvállalkozók vannak kint — az Ütemezés /
                        Naptár modul elkészültével jelenik meg itt.
                    </EmptyPanel>
                    <EmptyPanel title="Legutóbbi tevékenység">
                        Új munkanaplók, feltöltött dokumentumok és státuszváltások folyama
                        gyűlik majd ide.
                    </EmptyPanel>
                </div>
                <div className="space-y-4">
                    <EmptyPanel title="Riasztások">
                        Csúszó projektek, fogyó anyag, hamarosan lejáró alvállalkozói
                        dokumentumok és esedékes gépkarbantartás.
                    </EmptyPanel>
                    <EmptyPanel title="Pénzügyi pillanatkép">
                        Kintlévő kifizetések és költségtúllépések projektenként — a Pénzügy
                        modulból.
                    </EmptyPanel>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
