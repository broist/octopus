import { ReactNode } from 'react';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import PortalLayout from '@/Layouts/PortalLayout';
import UpdatePasswordForm from '@/Pages/Profile/Partials/UpdatePasswordForm';
import { usePageProps } from '@/hooks/usePageProps';
import type { PortalPartner } from '@/types/portal';

interface AccountProps extends Record<string, unknown> {
    partner: PortalPartner | null;
}

/**
 * Az ügyfél saját fiókja: a belépési adatok és a jelszóváltás. Több beállítás
 * szándékosan nincs — a portál egyetlen dolgot kér a megrendelőtől: lépjen be
 * és nézze meg a munkáját.
 */
export default function Account() {
    const { partner, auth } = usePageProps<AccountProps>();

    return (
        <>
            <Head title="Fiók és jelszó" />

            <Link
                href={route('ugyfel.index')}
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
            >
                <ArrowLeft size={16} />
                Vissza a projektjeimhez
            </Link>

            <h1 className="mb-5 text-2xl font-semibold tracking-tight text-sidebar">
                Fiók és jelszó
            </h1>

            <div className="space-y-4">
                <section className="o-card p-6">
                    <h2 className="text-base font-semibold text-sidebar">Belépési adatok</h2>
                    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-ink-faint">Név</dt>
                            <dd className="font-medium text-ink">{auth.user?.name}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-ink-faint">E-mail cím</dt>
                            <dd className="font-medium text-ink">{auth.user?.email}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-ink-faint">Megrendelő</dt>
                            <dd className="font-medium text-ink">{partner?.name ?? '–'}</dd>
                        </div>
                    </dl>
                    <p className="mt-4 text-xs text-ink-faint">
                        Ha az adatai megváltoztak, jelezze a kapcsolattartójának.
                    </p>
                </section>

                <UpdatePasswordForm />
            </div>
        </>
    );
}

Account.layout = (page: ReactNode) => <PortalLayout>{page}</PortalLayout>;
