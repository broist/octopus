import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { Check, Copy, Download, KeyRound, TriangleAlert } from 'lucide-react';

export type IssuedKey =
    | { kind: 'token'; device: string; token: string }
    | { kind: 'profile'; device: string; url: string };

/**
 * A frissen kiadott naptár-jelszó megjelenítése.
 *
 * Szándékosan párbeszédablakban: az oldalba ágyazott doboz a telefon
 * képernyőjén a görgetési pozíció fölé kerülhet, és a felhasználó azt hiszi,
 * nem történt semmi. A kulcs a bezárás után végleg eltűnik — csak a
 * lenyomata marad meg —, ezért a bezárás megerősítést kér.
 */
export default function CalendarKeyDialog({
    issued,
    onClose,
}: {
    issued: IssuedKey | null;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    const close = () => {
        setCopied(false);
        setDownloaded(false);
        onClose();
    };

    const confirmClose = () => {
        if (issued?.kind === 'token' && !copied) {
            const ok = window.confirm(
                'A naptár-jelszó a bezárás után többé nem jeleníthető meg. Biztosan bezárod?',
            );
            if (!ok) return;
        }
        close();
    };

    const copy = async () => {
        if (issued?.kind !== 'token') return;
        await navigator.clipboard.writeText(issued.token);
        setCopied(true);
    };

    return (
        <Dialog open={issued !== null} onClose={confirmClose} className="relative z-[70]">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md overflow-hidden rounded-[8px] border border-line bg-white shadow-[0_12px_40px_rgba(33,56,46,0.25)]">
                    <div className="flex gap-3 px-5 py-4">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent">
                            {issued?.kind === 'profile' ? (
                                <Download size={18} />
                            ) : (
                                <KeyRound size={18} />
                            )}
                        </span>
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-sm font-semibold text-sidebar">
                                {issued?.kind === 'profile'
                                    ? 'A konfigurációs profil elkészült'
                                    : 'A naptár-jelszó elkészült'}
                            </DialogTitle>
                            <p className="mt-1 text-[13px] text-ink-soft">
                                Eszköz: <strong className="text-ink">{issued?.device}</strong>
                            </p>

                            {issued?.kind === 'token' && (
                                <>
                                    <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                                        Ezt a jelszót írd be a telefon naptár-beállításánál.
                                        Felhasználónévnek az Octopus e-mail-címed kell.
                                    </p>

                                    <div className="mt-3 rounded-lg border border-line bg-cream/60 p-3 text-center">
                                        <code className="select-all font-mono text-lg tracking-widest text-ink">
                                            {issued.token}
                                        </code>
                                    </div>

                                    <button
                                        type="button"
                                        className="btn-primary mt-3 w-full justify-center"
                                        onClick={copy}
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                        <span className="ml-1.5">
                                            {copied ? 'Vágólapra másolva' : 'Másolás'}
                                        </span>
                                    </button>
                                </>
                            )}

                            {issued?.kind === 'profile' && (
                                <>
                                    <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                                        Töltsd le, majd telepítsd a telefon Beállításaiban:
                                        <strong className="text-ink"> Profil letöltve</strong> →
                                        Telepítés. A naptár-jelszót nem kell begépelned.
                                    </p>

                                    <a
                                        href={issued.url}
                                        className="btn-primary mt-3 w-full justify-center"
                                        onClick={() => setDownloaded(true)}
                                    >
                                        <Download size={16} />
                                        <span className="ml-1.5">Profil letöltése</span>
                                    </a>

                                    {downloaded && (
                                        <p className="mt-2 text-xs text-ink-soft">
                                            Ha nem indult el, koppints még egyszer — a
                                            hivatkozás negyed óráig érvényes.
                                        </p>
                                    )}
                                </>
                            )}

                            <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft">
                                <TriangleAlert
                                    size={14}
                                    className="mt-0.5 shrink-0 text-amberwarn"
                                />
                                <span>
                                    Bezárás után <strong>nem jeleníthető meg újra</strong> — az
                                    Octopus csak a lenyomatát tárolja. Ha elveszik, generálj
                                    újat, a régit pedig vond vissza.
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-line bg-cream/40 px-5 py-3">
                        <button
                            className="btn !py-1.5 bg-accent text-[13px] text-white hover:bg-accent-600"
                            onClick={confirmClose}
                        >
                            Kész
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
