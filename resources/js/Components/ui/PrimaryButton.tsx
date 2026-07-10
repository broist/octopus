import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

export default function PrimaryButton({
    className,
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            disabled={disabled}
            className={clsx('btn-primary w-full', disabled && 'cursor-not-allowed', className)}
        >
            {children}
        </button>
    );
}
