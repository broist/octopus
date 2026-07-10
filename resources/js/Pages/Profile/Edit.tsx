import { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import UpdateProfileInformationForm from '@/Pages/Profile/Partials/UpdateProfileInformationForm';
import UpdatePasswordForm from '@/Pages/Profile/Partials/UpdatePasswordForm';
import TwoFactorAuthenticationForm from '@/Pages/Profile/Partials/TwoFactorAuthenticationForm';

export default function Edit() {
    return (
        <>
            <Head title="Profil és biztonság" />

            <PageHeader
                title="Profil és biztonság"
                subtitle="Fiókadatok, jelszó és kétfaktoros hitelesítés kezelése."
            />

            <div className="max-w-3xl space-y-6">
                <UpdateProfileInformationForm />
                <UpdatePasswordForm />
                <TwoFactorAuthenticationForm />
            </div>
        </>
    );
}

Edit.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
