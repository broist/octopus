import { FormEventHandler } from 'react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';

export default function UpdateProfileInformationForm() {
    const user = usePageProps().auth.user;

    const { data, setData, put, processing, errors, recentlySuccessful } = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        job_title: user?.job_title ?? '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put('/user/profile-information', { preserveScroll: true });
    };

    return (
        <section className="o-card p-6">
            <header>
                <h2 className="text-base font-semibold text-sidebar">Profil adatok</h2>
                <p className="mt-1 text-sm text-ink-soft">
                    Frissítse a fiókjához tartozó nevet és elérhetőségeket.
                </p>
            </header>

            <form onSubmit={submit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <InputLabel htmlFor="name" value="Név" />
                    <TextInput
                        id="name"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        autoComplete="name"
                    />
                    <InputError message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="E-mail cím" />
                    <TextInput
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        autoComplete="username"
                    />
                    <InputError message={errors.email} />
                </div>

                <div>
                    <InputLabel htmlFor="phone" value="Telefonszám" />
                    <TextInput
                        id="phone"
                        value={data.phone}
                        onChange={(e) => setData('phone', e.target.value)}
                        autoComplete="tel"
                    />
                    <InputError message={errors.phone} />
                </div>

                <div>
                    <InputLabel htmlFor="job_title" value="Beosztás" />
                    <TextInput
                        id="job_title"
                        value={data.job_title}
                        onChange={(e) => setData('job_title', e.target.value)}
                    />
                    <InputError message={errors.job_title} />
                </div>

                <div className="flex items-center gap-3 sm:col-span-2">
                    <button type="submit" className="btn-primary" disabled={processing}>
                        Mentés
                    </button>
                    {recentlySuccessful && (
                        <span className="text-sm text-accent">Mentve.</span>
                    )}
                </div>
            </form>
        </section>
    );
}
