import { FormEventHandler, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import {
    CalendarClock,
    Check,
    Copy,
    Download,
    Smartphone,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import InputError from '@/Components/ui/InputError';

type Device = {
    id: number;
    name: string;
    created_at: string | null;
    last_used_at: string | null;
    last_ip: string | null;
    revoked: boolean;
};

type CalendarInfo = {
    key: string;
    name: string;
    description: string;
    writable: boolean;
};

export type CalendarSyncProps = {
    enabled: boolean;
    serverUrl: string;
    username: string;
    calendars: CalendarInfo[];
    devices: Device[];
};

const formatDate = (value: string | null) =>
    value
        ? new Date(value).toLocaleString('hu-HU', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '–';

export default function CalendarSyncForm({
    sync,
    token,
    tokenDevice,
    profileUrl,
}: {
    sync: CalendarSyncProps;
    token?: string | null;
    tokenDevice?: string | null;
    profileUrl?: string | null;
}) {
    const [copied, setCopied] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
    });
    const profileForm = useForm({ name: 'iPhone' });

    if (!sync.enabled) {
        return null;
    }

    const createToken: FormEventHandler = (e) => {
        e.preventDefault();
        post('/profile/calendar-sync', {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    const prepareProfile: FormEventHandler = (e) => {
        e.preventDefault();
        profileForm.post('/profile/calendar-sync/mobileconfig', {
            preserveScroll: true,
        });
    };

    const revoke = (device: Device) => {
        if (
            !window.confirm(
                `Biztosan visszavonod a(z) „${device.name}” eszköz naptár-jelszavát? ` +
                    'Az eszköz ezután nem szinkronizál tovább.',
            )
        ) {
            return;
        }
        router.delete(`/profile/calendar-sync/${device.id}`, { preserveScroll: true });
    };

    const copyToken = async () => {
        if (!token) return;
        await navigator.clipboard.writeText(token);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="o-card p-6">
            <header className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent">
                    <CalendarClock size={20} />
                </span>
                <div>
                    <h2 className="text-base font-semibold text-sidebar">Naptár-szinkron</h2>
                    <p className="mt-1 text-sm text-ink-soft">
                        Kösd össze a telefonod naptárát az Octopusszal. A szinkron
                        kétirányú: amit a telefonon veszel fel, megjelenik itt is, és
                        fordítva.
                    </p>
                </div>
            </header>

            {/* Frissen generált kulcs — csak most látható */}
            {token && (
                <div className="mt-5 rounded-lg border border-accent/40 bg-accent-50/60 p-4">
                    <p className="text-sm font-medium text-ink">
                        A(z) „{tokenDevice}” eszköz naptár-jelszava elkészült
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                        Írd be a telefon naptár-beállításánál. <strong>Csak most
                        látható</strong> — ha elveszik, generálj újat.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <code className="select-all rounded border border-line bg-white px-3 py-2 font-mono text-sm tracking-wide text-ink">
                            {token}
                        </code>
                        <button type="button" className="btn-ghost" onClick={copyToken}>
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            <span className="ml-1.5">{copied ? 'Másolva' : 'Másolás'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* iPhone: konfigurációs profil — a jelszót nem kell begépelni */}
            <div className="mt-5 rounded-lg border border-line bg-cream/60 p-4">
                <div className="flex items-start gap-2">
                    <Smartphone size={18} className="mt-0.5 shrink-0 text-ink-soft" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                            iPhone / iPad – automatikus beállítás
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">
                            Töltsd le a konfigurációs profilt, nyisd meg a telefonon, és
                            telepítsd (Beállítások → Profil letöltve → Telepítés). A
                            naptár-jelszót nem kell begépelned — a fájl tartalmazza.
                        </p>
                    </div>
                </div>

                <form onSubmit={prepareProfile} className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="w-56">
                        <InputLabel htmlFor="mobileconfig_name" value="Eszköz neve" />
                        <TextInput
                            id="mobileconfig_name"
                            value={profileForm.data.name}
                            onChange={(e) => profileForm.setData('name', e.target.value)}
                            maxLength={100}
                        />
                        <InputError message={profileForm.errors.name} />
                    </div>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={profileForm.processing}
                    >
                        Profil előkészítése
                    </button>
                </form>

                {/* A letöltés sima hivatkozás (GET): az iOS beépített böngészője
                    a fájlt visszaadó POST-választ újraküldi GET-tel, ezért a
                    közvetlen POST-os letöltés a telefonon elhasalna. */}
                {profileUrl && (
                    <div className="mt-3 rounded-lg border border-accent/40 bg-accent-50/60 p-3">
                        <p className="text-sm font-medium text-ink">
                            A profil elkészült
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">
                            Koppints a letöltésre, majd a telefon Beállításaiban
                            telepítsd. A hivatkozás <strong>egyszer</strong> használható.
                        </p>
                        <a href={profileUrl} className="btn-primary mt-2 inline-flex">
                            <Download size={16} />
                            <span className="ml-1.5">Profil letöltése</span>
                        </a>
                    </div>
                )}
            </div>

            {/* Kézi beállítás (Android / egyéb kliens) */}
            <div className="mt-5">
                <h3 className="text-sm font-semibold text-ink">Kézi beállítás</h3>
                <p className="mt-1 text-xs text-ink-soft">
                    Androidon a DAVx⁵ alkalmazás kell hozzá. Add meg ezeket az adatokat,
                    jelszónak pedig az alább generált naptár-jelszót.
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                    <dt className="text-ink-soft">Szerver</dt>
                    <dd className="font-mono text-xs text-ink sm:text-sm">
                        {sync.serverUrl}
                    </dd>
                    <dt className="text-ink-soft">Felhasználónév</dt>
                    <dd className="font-mono text-xs text-ink sm:text-sm">
                        {sync.username}
                    </dd>
                </dl>

                <form onSubmit={createToken} className="mt-4 flex flex-wrap items-end gap-2">
                    <div className="w-56">
                        <InputLabel htmlFor="device_name" value="Eszköz neve" />
                        <TextInput
                            id="device_name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="pl. Munkatelefon"
                            maxLength={100}
                        />
                        <InputError message={errors.name} />
                    </div>
                    <button type="submit" className="btn-ghost" disabled={processing}>
                        Naptár-jelszó generálása
                    </button>
                </form>
            </div>

            {/* Kiadott naptárak */}
            <div className="mt-6">
                <h3 className="text-sm font-semibold text-ink">Megjelenő naptárak</h3>
                <ul className="mt-2 space-y-1.5">
                    {sync.calendars.map((calendar) => (
                        <li key={calendar.key} className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-medium text-ink">
                                {calendar.name}
                            </span>
                            <span
                                className={
                                    calendar.writable ? 'chip chip-green' : 'chip'
                                }
                            >
                                {calendar.writable ? 'szerkeszthető' : 'csak olvasható'}
                            </span>
                            <span className="w-full text-xs text-ink-soft sm:w-auto">
                                {calendar.description}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Csatlakoztatott eszközök */}
            <div className="mt-6">
                <h3 className="text-sm font-semibold text-ink">Csatlakoztatott eszközök</h3>

                {sync.devices.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-soft">
                        Még nincs csatlakoztatott eszköz.
                    </p>
                ) : (
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[34rem] text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                                    <th className="py-2 pr-3 font-medium">Eszköz</th>
                                    <th className="py-2 pr-3 font-medium">Létrehozva</th>
                                    <th className="py-2 pr-3 font-medium">
                                        Utolsó szinkron
                                    </th>
                                    <th className="py-2 pr-3 font-medium">IP</th>
                                    <th className="py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {sync.devices.map((device) => (
                                    <tr
                                        key={device.id}
                                        className="border-b border-line/60 last:border-0"
                                    >
                                        <td className="py-2 pr-3 text-ink">
                                            {device.name}
                                            {device.revoked && (
                                                <span className="ml-2 chip">visszavonva</span>
                                            )}
                                        </td>
                                        <td className="py-2 pr-3 text-ink-soft">
                                            {formatDate(device.created_at)}
                                        </td>
                                        <td className="py-2 pr-3 text-ink-soft">
                                            {formatDate(device.last_used_at)}
                                        </td>
                                        <td className="py-2 pr-3 font-mono text-xs text-ink-soft">
                                            {device.last_ip ?? '–'}
                                        </td>
                                        <td className="py-2 text-right">
                                            {!device.revoked && (
                                                <button
                                                    type="button"
                                                    className="btn-ghost text-coral"
                                                    onClick={() => revoke(device)}
                                                    title="Naptár-jelszó visszavonása"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <p className="mt-5 flex items-start gap-2 text-xs text-ink-soft">
                <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amberwarn" />
                <span>
                    A naptár-jelszó <strong>kizárólag a naptár-végpontot</strong> nyitja
                    meg — weben nem lehet vele belépni, és más modulhoz sem fér hozzá.
                    Elveszett telefon esetén vond vissza itt; a fiókod jelszava és a
                    kétfaktoros hitelesítés érintetlen marad.
                </span>
            </p>
        </section>
    );
}
