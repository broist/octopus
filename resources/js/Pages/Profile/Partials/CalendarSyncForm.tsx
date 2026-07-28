import { FormEventHandler, useState } from 'react';
import { router } from '@inertiajs/react';
import { CalendarClock, Smartphone, Trash2, TriangleAlert } from 'lucide-react';
import InputLabel from '@/Components/ui/InputLabel';
import TextInput from '@/Components/ui/TextInput';
import CalendarKeyDialog, { IssuedKey } from '@/Pages/Profile/Partials/CalendarKeyDialog';

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

export default function CalendarSyncForm({ sync }: { sync: CalendarSyncProps }) {
    // Kitöltött alapértékek: a gombok elsőre működnek, és nem tűnik úgy, hogy
    // nem történik semmi, ha a felhasználó nem ír be nevet.
    const [deviceName, setDeviceName] = useState('Telefon');
    const [profileName, setProfileName] = useState('iPhone');
    const [issued, setIssued] = useState<IssuedKey | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!sync.enabled) {
        return null;
    }

    /**
     * A kérést axiosszal küldjük, nem Inertiával: a választ így közvetlenül
     * megkapjuk és párbeszédablakban mutatjuk. Az Inertia-s átirányítás után
     * megjelenő doboz a telefonon a görgetési pozíció fölé kerülhetett, és a
     * felhasználó nem látta a frissen kiadott kulcsot.
     */
    const send = async <T,>(url: string, name: string, toIssued: (data: T) => IssuedKey) => {
        setBusy(true);
        setError(null);
        try {
            const response = await window.axios.post(url, { name });
            setIssued(toIssued(response.data));
            // Az eszközlista frissüljön, de a párbeszéd állapota maradjon meg.
            router.reload({ only: ['calendarSync'] });
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(
                err.response?.data?.message ??
                    'Nem sikerült létrehozni a naptár-jelszót. Próbáld újra, vagy jelentkezz be ismét.',
            );
        } finally {
            setBusy(false);
        }
    };

    const createToken: FormEventHandler = (e) => {
        e.preventDefault();
        void send<{ device: string; token: string }>(
            '/profile/calendar-sync',
            deviceName,
            (d) => ({ kind: 'token', device: d.device, token: d.token }),
        );
    };

    const prepareProfile: FormEventHandler = (e) => {
        e.preventDefault();
        void send<{ device: string; url: string }>(
            '/profile/calendar-sync/mobileconfig',
            profileName,
            (d) => ({ kind: 'profile', device: d.device, url: d.url }),
        );
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

            {/* A frissen kiadott kulcs párbeszédablakban jelenik meg — az
                oldalba ágyazott doboz a telefonon a látható terület fölé
                kerülhetett, és észrevétlen maradt. */}
            <CalendarKeyDialog issued={issued} onClose={() => setIssued(null)} />

            {error && (
                <p className="mt-4 rounded-lg border border-coral/40 bg-coral/5 px-3 py-2 text-sm text-coral">
                    {error}
                </p>
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
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            maxLength={100}
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={busy}>
                        Profil előkészítése
                    </button>
                </form>
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
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            placeholder="pl. Munkatelefon"
                            maxLength={100}
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={busy}>
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
