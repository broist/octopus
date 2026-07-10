import { Head, Link } from '@inertiajs/react';

interface WelcomeProps {
    appName: string;
}

export default function Welcome({ appName }: WelcomeProps) {
    return (
        <>
            <Head title="Üdvözöljük" />

            <div className="relative min-h-screen overflow-hidden bg-cream">
                {/* Soft decorative wash */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                        background:
                            'radial-gradient(1200px 600px at 15% -10%, rgba(46,107,79,0.10), transparent 60%), radial-gradient(900px 500px at 110% 120%, rgba(33,56,46,0.10), transparent 55%)',
                    }}
                />

                <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
                    <img
                        src="/octopus-mark.png"
                        alt="Octopus"
                        className="h-28 w-28 object-contain"
                    />

                    <h1 className="mt-6 text-4xl font-semibold tracking-tight text-sidebar sm:text-5xl">
                        {appName}
                    </h1>
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.35em] text-accent">
                        Építőipar
                    </p>

                    <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft">
                        Projektvezető és rendszerező rendszer építőipari cégeknek —
                        projektek, alvállalkozók, erőforrások, dokumentumok és pénzügyek
                        egy helyen.
                    </p>

                    <div className="mt-9 flex items-center gap-3">
                        <Link href={route('login')} className="btn-primary px-6 py-2.5">
                            Belépés
                        </Link>
                        <a href="#modulok" className="btn-ghost px-6 py-2.5">
                            A rendszerről
                        </a>
                    </div>

                    <div
                        id="modulok"
                        className="mt-16 grid w-full grid-cols-2 gap-3 sm:grid-cols-4"
                    >
                        {[
                            'Projektek',
                            'Alvállalkozók',
                            'Ütemezés',
                            'Pénzügy',
                            'Dokumentumtár',
                            'Munkanapló',
                            'Feladatok',
                            'Riportok',
                        ].map((label) => (
                            <div
                                key={label}
                                className="o-card px-4 py-3 text-sm font-medium text-ink-soft"
                            >
                                {label}
                            </div>
                        ))}
                    </div>

                    <p className="mt-14 text-xs text-ink-faint">
                        © {new Date().getFullYear()} Octopus · Építőipari projektvezető
                    </p>
                </div>
            </div>
        </>
    );
}
