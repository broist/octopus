import { FormEventHandler } from 'react';
import { Head, useForm } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import PrimaryButton from '@/Components/ui/PrimaryButton';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/user/confirm-password', {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout
            title="Biztonsági megerősítés"
            description="Ez egy védett terület. Kérjük, erősítse meg a jelszavával."
        >
            <Head title="Jelszó megerősítése" />

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <InputLabel htmlFor="password" value="Jelszó" />
                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        autoComplete="current-password"
                        isFocused
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <InputError message={errors.password} />
                </div>

                <PrimaryButton disabled={processing}>Megerősítés</PrimaryButton>
            </form>
        </GuestLayout>
    );
}
