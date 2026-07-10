import clsx from 'clsx';

interface AppLogoProps {
    withWordmark?: boolean;
    className?: string;
    imgClassName?: string;
    /** Render wordmark text light (for the dark sidebar) or dark. */
    light?: boolean;
}

export default function AppLogo({
    withWordmark = true,
    className,
    imgClassName,
    light = false,
}: AppLogoProps) {
    return (
        <div className={clsx('flex items-center gap-3', className)}>
            <img
                src={light ? '/octopus-mark-light.png' : '/octopus-mark.png'}
                alt="Octopus"
                className={clsx('object-contain', imgClassName ?? 'h-9 w-9')}
            />
            {withWordmark && (
                <div className="leading-tight">
                    <div
                        className={clsx(
                            'text-base font-semibold tracking-wide',
                            light ? 'text-white' : 'text-sidebar',
                        )}
                    >
                        OCTOPUS
                    </div>
                    <div
                        className={clsx(
                            'text-[10px] font-medium uppercase tracking-[0.28em]',
                            light ? 'text-white/55' : 'text-accent',
                        )}
                    >
                        Építőipar
                    </div>
                </div>
            )}
        </div>
    );
}
