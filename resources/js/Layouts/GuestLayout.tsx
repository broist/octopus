import { PropsWithChildren, ReactNode } from 'react';
import AppLogo from '@/Components/AppLogo';

interface GuestLayoutProps {
    title: string;
    description?: ReactNode;
}

export default function GuestLayout({
    title,
    description,
    children,
}: PropsWithChildren<GuestLayoutProps>) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-10">
            <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                    background:
                        'radial-gradient(1000px 500px at 20% -10%, rgba(46,107,79,0.10), transparent 60%), radial-gradient(800px 500px at 110% 120%, rgba(33,56,46,0.10), transparent 55%)',
                }}
            />

            <div className="relative w-full max-w-md">
                <div className="mb-6 flex justify-center">
                    <AppLogo imgClassName="h-14 w-14" withWordmark={false} />
                </div>

                <div className="o-card px-7 py-8">
                    <h1 className="text-center text-xl font-semibold text-sidebar">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-1.5 text-center text-sm text-ink-soft">
                            {description}
                        </p>
                    )}

                    <div className="mt-6">{children}</div>
                </div>

                <p className="mt-6 text-center text-xs text-ink-faint">
                    Octopus · Építőipari projektvezető rendszer
                </p>
            </div>
        </div>
    );
}
