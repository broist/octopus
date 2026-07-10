import { useState } from 'react';
import { router } from '@inertiajs/react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';
import { usePageProps } from '@/hooks/usePageProps';

type Status = 'disabled' | 'confirming' | 'enabled';

export default function TwoFactorAuthenticationForm() {
    const user = usePageProps().auth.user;
    const [status, setStatus] = useState<Status>(
        user?.two_factor_enabled ? 'enabled' : 'disabled',
    );
    const [qrSvg, setQrSvg] = useState<string | null>(null);
    const [secretKey, setSecretKey] = useState<string | null>(null);
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const loadSetup = async () => {
        const [qr, secret] = await Promise.all([
            window.axios.get('/user/two-factor-qr-code'),
            window.axios.get('/user/two-factor-secret-key'),
        ]);
        setQrSvg(qr.data.svg);
        setSecretKey(secret.data.secretKey);
    };

    const enable = async () => {
        setBusy(true);
        setError(null);
        try {
            await window.axios.post('/user/two-factor-authentication');
            await loadSetup();
            setStatus('confirming');
        } catch {
            setError('Nem sikerült elindítani a kétfaktoros hitelesítést.');
        } finally {
            setBusy(false);
        }
    };

    const confirm = async () => {
        setBusy(true);
        setError(null);
        try {
            await window.axios.post('/user/confirmed-two-factor-authentication', { code });
            const codes = await window.axios.get('/user/two-factor-recovery-codes');
            setRecoveryCodes(codes.data);
            setStatus('enabled');
            setCode('');
            router.reload({ only: ['auth'] });
        } catch {
            setError('Érvénytelen kód. Próbálja újra.');
        } finally {
            setBusy(false);
        }
    };

    const showRecoveryCodes = async () => {
        const codes = await window.axios.get('/user/two-factor-recovery-codes');
        setRecoveryCodes(codes.data);
    };

    const disable = async () => {
        setBusy(true);
        try {
            await window.axios.delete('/user/two-factor-authentication');
            setStatus('disabled');
            setQrSvg(null);
            setSecretKey(null);
            setRecoveryCodes([]);
            router.reload({ only: ['auth'] });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="o-card p-6">
            <header className="flex items-start gap-3">
                <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        status === 'enabled'
                            ? 'bg-accent-50 text-accent'
                            : 'bg-amberwarn/10 text-amberwarn'
                    }`}
                >
                    {status === 'enabled' ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                </span>
                <div>
                    <h2 className="text-base font-semibold text-sidebar">
                        Kétfaktoros hitelesítés (2FA)
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                        Extra biztonsági réteg egy hitelesítő alkalmazással (pl. Google
                        Authenticator, 1Password).
                    </p>
                </div>
            </header>

            <div className="mt-5">
                {status === 'disabled' && (
                    <button className="btn-primary" onClick={enable} disabled={busy}>
                        2FA bekapcsolása
                    </button>
                )}

                {status === 'confirming' && (
                    <div className="space-y-4">
                        <p className="text-sm text-ink-soft">
                            Olvassa be a QR-kódot a hitelesítő alkalmazással, majd adja meg a
                            megjelenő kódot a megerősítéshez.
                        </p>
                        {qrSvg && (
                            <div
                                className="inline-block rounded-lg border border-line bg-white p-3"
                                dangerouslySetInnerHTML={{ __html: qrSvg }}
                            />
                        )}
                        {secretKey && (
                            <p className="text-xs text-ink-faint">
                                Kézi kulcs: <code className="text-ink">{secretKey}</code>
                            </p>
                        )}
                        <div className="max-w-xs">
                            <InputLabel htmlFor="tfa_code" value="Megerősítő kód" />
                            <TextInput
                                id="tfa_code"
                                inputMode="numeric"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                            <InputError message={error ?? undefined} />
                        </div>
                        <div className="flex gap-2">
                            <button className="btn-primary" onClick={confirm} disabled={busy}>
                                Megerősítés
                            </button>
                            <button className="btn-ghost" onClick={disable} disabled={busy}>
                                Mégse
                            </button>
                        </div>
                    </div>
                )}

                {status === 'enabled' && (
                    <div className="space-y-4">
                        <div className="chip chip-green">Bekapcsolva</div>

                        {recoveryCodes.length > 0 && (
                            <div className="rounded-lg border border-line bg-cream/60 p-4">
                                <p className="mb-2 text-sm font-medium text-ink">
                                    Helyreállítási kódok
                                </p>
                                <p className="mb-3 text-xs text-ink-soft">
                                    Őrizze biztonságos helyen. Ezekkel akkor is beléphet, ha
                                    nincs a telefonja kéznél.
                                </p>
                                <div className="grid grid-cols-2 gap-1 font-mono text-xs text-ink">
                                    {recoveryCodes.map((rc) => (
                                        <div key={rc}>{rc}</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <button
                                className="btn-ghost"
                                onClick={showRecoveryCodes}
                                disabled={busy}
                            >
                                Helyreállítási kódok megjelenítése
                            </button>
                            <button
                                className="btn inline-flex border border-coral/40 bg-coral/5 text-coral hover:bg-coral/10"
                                onClick={disable}
                                disabled={busy}
                            >
                                2FA kikapcsolása
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
