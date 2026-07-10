import { FormEventHandler, useRef } from 'react';
import { useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput, { TextInputRef } from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';

export default function UpdatePasswordForm() {
    const passwordInput = useRef<TextInputRef>(null);
    const currentPasswordInput = useRef<TextInputRef>(null);

    const { data, setData, put, processing, errors, reset, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put('/user/password', {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (err) => {
                if (err.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current?.focus();
                }
                if (err.current_password) {
                    reset('current_password');
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    return (
        <section className="o-card p-6">
            <header>
                <h2 className="text-base font-semibold text-sidebar">Jelszó módosítása</h2>
                <p className="mt-1 text-sm text-ink-soft">
                    Használjon hosszú, egyedi jelszót a fiók biztonsága érdekében.
                </p>
            </header>

            <form onSubmit={submit} className="mt-5 max-w-md space-y-4">
                <div>
                    <InputLabel htmlFor="current_password" value="Jelenlegi jelszó" />
                    <TextInput
                        id="current_password"
                        ref={currentPasswordInput}
                        type="password"
                        value={data.current_password}
                        onChange={(e) => setData('current_password', e.target.value)}
                        autoComplete="current-password"
                    />
                    <InputError message={errors.current_password} />
                </div>

                <div>
                    <InputLabel htmlFor="password" value="Új jelszó" />
                    <TextInput
                        id="password"
                        ref={passwordInput}
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        autoComplete="new-password"
                    />
                    <InputError message={errors.password} />
                </div>

                <div>
                    <InputLabel htmlFor="password_confirmation" value="Új jelszó megerősítése" />
                    <TextInput
                        id="password_confirmation"
                        type="password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        autoComplete="new-password"
                    />
                    <InputError message={errors.password_confirmation} />
                </div>

                <div className="flex items-center gap-3">
                    <button type="submit" className="btn-primary" disabled={processing}>
                        Jelszó mentése
                    </button>
                    {recentlySuccessful && (
                        <span className="text-sm text-accent">Mentve.</span>
                    )}
                </div>
            </form>
        </section>
    );
}
