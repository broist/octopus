import clsx from 'clsx';

interface ProgressBarProps {
    value: number; // 0–100
    warn?: boolean; // csúszás → korall
    className?: string;
}

export default function ProgressBar({ value, warn = false, className }: ProgressBarProps) {
    const clamped = Math.max(0, Math.min(100, value));

    return (
        <div
            className={clsx('h-2 w-full overflow-hidden rounded-sm bg-line', className)}
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className={clsx(
                    'h-full rounded-sm transition-all',
                    warn ? 'bg-coral' : 'bg-accent',
                )}
                style={{ width: `${clamped}%` }}
            />
        </div>
    );
}
