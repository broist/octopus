import { LabelHTMLAttributes } from 'react';
import clsx from 'clsx';

export default function InputLabel({
    value,
    className,
    children,
    ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { value?: string }) {
    return (
        <label
            {...props}
            className={clsx('mb-1 block text-sm font-medium text-ink', className)}
        >
            {value ?? children}
        </label>
    );
}
