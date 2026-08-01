import { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import { Info } from 'lucide-react';
import PortalLayout from '@/Layouts/PortalLayout';

/**
 * Külső fiók megrendelő nélkül: a hozzáférés létrejött, de nincs mihez kötni.
 * Csupasz 403 helyett elmondjuk, mi a teendő — kilépni is tud a fejlécből.
 */
export default function NoAccess() {
    return (
        <>
            <Head title="Ügyfélportál" />

            <div className="o-card mx-auto max-w-lg px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-accent-50 text-accent">
                    <Info size={24} />
                </span>
                <h1 className="mt-4 text-lg font-semibold text-sidebar">
                    A fiókja még beállítás alatt van
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
                    A belépés sikerült, de a fiókjához még nincs megrendelő rendelve, ezért
                    nincs megjeleníthető projekt. Kérjük, jelezze a kapcsolattartójának — pár
                    kattintás nekik is.
                </p>
            </div>
        </>
    );
}

NoAccess.layout = (page: ReactNode) => <PortalLayout>{page}</PortalLayout>;
