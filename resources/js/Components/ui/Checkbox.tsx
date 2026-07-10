import { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export default function Checkbox({
    className,
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            type="checkbox"
            className={clsx(
                'rounded border-line text-accent shadow-sm focus:ring-accent/40',
                className,
            )}
        />
    );
}
