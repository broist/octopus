import { FormEventHandler } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import PrimaryButton from '@/Components/ui/PrimaryButton';

interface LoginProps {
    canResetPassword: boolean;
    status?: string;
}

export default function Login({ canResetPassword, status }: LoginProps) {
    // Nincs „emlékezz rám": biztonsági döntés, hogy minden új munkamenet teljes
    // belépést kérjen (jelszó + MFA). A tartós süti megkerülné ezt.
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/login', {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout title="Belépés" description="Lépjen be az Octopus fiókjába">
            <Head title="Belépés" />

            {status && (
                <div className="mb-4 rounded-lg bg-accent-50 px-4 py-2 text-sm font-medium text-accent-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <InputLabel htmlFor="email" value="E-mail cím" />
                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        autoComplete="username"
                        isFocused
                        onChange={(e) => setData('email', e.target.value)}
                    />
                    <InputError message={errors.email} />
                </div>

                <div>
                    <InputLabel htmlFor="password" value="Jelszó" />
                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <InputError message={errors.password} />
                </div>

                {canResetPassword && (
                    <div className="flex justify-end">
                        <Link
                            href={route('password.request')}
                            className="text-sm font-medium text-accent hover:text-accent-700"
                        >
                            Elfelejtette a jelszavát?
                        </Link>
                    </div>
                )}

                <PrimaryButton disabled={processing}>Belépés</PrimaryButton>
            </form>
        </GuestLayout>
    );
}
