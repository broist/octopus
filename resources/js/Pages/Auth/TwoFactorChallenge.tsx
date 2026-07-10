import { FormEventHandler, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import PrimaryButton from '@/Components/ui/PrimaryButton';

export default function TwoFactorChallenge() {
    const [recovery, setRecovery] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        code: '',
        recovery_code: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/two-factor-challenge');
    };

    const toggle = () => {
        setRecovery((prev) => !prev);
        reset('code', 'recovery_code');
    };

    return (
        <GuestLayout
            title="Kétfaktoros hitelesítés"
            description={
                recovery
                    ? 'Adja meg az egyik helyreállítási kódját.'
                    : 'Adja meg a hitelesítő alkalmazás által generált kódot.'
            }
        >
            <Head title="Kétfaktoros hitelesítés" />

            <form onSubmit={submit} className="space-y-4">
                {!recovery ? (
                    <div>
                        <InputLabel htmlFor="code" value="Hitelesítő kód" />
                        <TextInput
                            id="code"
                            type="text"
                            name="code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={data.code}
                            isFocused
                            onChange={(e) => setData('code', e.target.value)}
                        />
                        <InputError message={errors.code} />
                    </div>
                ) : (
                    <div>
                        <InputLabel htmlFor="recovery_code" value="Helyreállítási kód" />
                        <TextInput
                            id="recovery_code"
                            type="text"
                            name="recovery_code"
                            autoComplete="one-time-code"
                            value={data.recovery_code}
                            isFocused
                            onChange={(e) => setData('recovery_code', e.target.value)}
                        />
                        <InputError message={errors.recovery_code} />
                    </div>
                )}

                <PrimaryButton disabled={processing}>Belépés</PrimaryButton>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={toggle}
                        className="text-sm font-medium text-accent hover:text-accent-700"
                    >
                        {recovery
                            ? 'Hitelesítő kód használata'
                            : 'Helyreállítási kód használata'}
                    </button>
                </div>
            </form>
        </GuestLayout>
    );
}
