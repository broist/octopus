import { FormEventHandler } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import PrimaryButton from '@/Components/ui/PrimaryButton';
import Checkbox from '@/Components/ui/Checkbox';

interface WelcomeProps {
    appName: string;
    canResetPassword: boolean;
    status?: string;
}

/**
 * Nyitólap (cloud.acuwall.hu gyökér). Csak a márka — ikon és név — és a
 * belépési űrlap látszik; a bejelentkezés a Fortify /login végpontjára megy.
 */
export default function Welcome({ appName, canResetPassword, status }: WelcomeProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/login', {
            onFinish: () => reset('password'),
        });
    };

    return (
        <>
            <Head title="Belépés" />

            <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream px-4 py-10">
                {/* Lágy dekoratív háttér */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                        background:
                            'radial-gradient(1000px 500px at 20% -10%, rgba(46,107,79,0.10), transparent 60%), radial-gradient(800px 500px at 110% 120%, rgba(33,56,46,0.10), transparent 55%)',
                    }}
                />

                <div className="relative w-full max-w-md">
                    {/* Ikon + név */}
                    <div className="mb-7 flex flex-col items-center text-center">
                        <img
                            src="/octopus-mark.png"
                            alt={appName}
                            className="h-20 w-20 object-contain"
                        />
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-sidebar">
                            {appName}
                        </h1>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.35em] text-accent">
                            Építőipar
                        </p>
                    </div>

                    {/* Belépési űrlap */}
                    <div className="o-card px-7 py-8">
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

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm text-ink-soft">
                                    <Checkbox
                                        name="remember"
                                        checked={data.remember}
                                        onChange={(e) => setData('remember', e.target.checked)}
                                    />
                                    Emlékezzen rám
                                </label>

                                {canResetPassword && (
                                    <Link
                                        href={route('password.request')}
                                        className="text-sm font-medium text-accent hover:text-accent-700"
                                    >
                                        Elfelejtette a jelszavát?
                                    </Link>
                                )}
                            </div>

                            <PrimaryButton disabled={processing}>Belépés</PrimaryButton>
                        </form>
                    </div>

                    <p className="mt-6 text-center text-xs text-ink-faint">
                        © {new Date().getFullYear()} {appName} · Építőipari projektvezető rendszer
                    </p>
                </div>
            </div>
        </>
    );
}
