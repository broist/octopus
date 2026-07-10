import { FormEventHandler } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import PrimaryButton from '@/Components/ui/PrimaryButton';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/forgot-password');
    };

    return (
        <GuestLayout
            title="Elfelejtett jelszó"
            description="Adja meg az e-mail címét, és küldünk egy jelszó-visszaállító linket."
        >
            <Head title="Elfelejtett jelszó" />

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
                        isFocused
                        onChange={(e) => setData('email', e.target.value)}
                    />
                    <InputError message={errors.email} />
                </div>

                <PrimaryButton disabled={processing}>Visszaállító link küldése</PrimaryButton>

                <div className="text-center">
                    <Link
                        href={route('login')}
                        className="text-sm font-medium text-accent hover:text-accent-700"
                    >
                        Vissza a belépéshez
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
