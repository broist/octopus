import { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import UpdateProfileInformationForm from '@/Pages/Profile/Partials/UpdateProfileInformationForm';
import UpdatePasswordForm from '@/Pages/Profile/Partials/UpdatePasswordForm';
import TwoFactorAuthenticationForm from '@/Pages/Profile/Partials/TwoFactorAuthenticationForm';
import CalendarSyncForm, {
    CalendarSyncProps,
} from '@/Pages/Profile/Partials/CalendarSyncForm';

export default function Edit({
    calendarSync,
    calendarToken,
    calendarTokenDevice,
}: {
    calendarSync: CalendarSyncProps;
    calendarToken?: string | null;
    calendarTokenDevice?: string | null;
}) {
    return (
        <>
            <Head title="Profil és biztonság" />

            <PageHeader
                title="Profil és biztonság"
                subtitle="Fiókadatok, jelszó, kétfaktoros hitelesítés és naptár-szinkron kezelése."
            />

            <div className="max-w-3xl space-y-6">
                <UpdateProfileInformationForm />
                <UpdatePasswordForm />
                <TwoFactorAuthenticationForm />
                <CalendarSyncForm
                    sync={calendarSync}
                    token={calendarToken}
                    tokenDevice={calendarTokenDevice}
                />
            </div>
        </>
    );
}

Edit.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
