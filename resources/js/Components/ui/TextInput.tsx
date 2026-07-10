import {
    forwardRef,
    InputHTMLAttributes,
    useEffect,
    useImperativeHandle,
    useRef,
} from 'react';
import clsx from 'clsx';

export interface TextInputRef {
    focus: () => void;
}

export default forwardRef<TextInputRef, InputHTMLAttributes<HTMLInputElement> & { isFocused?: boolean }>(
    function TextInput({ className, isFocused = false, ...props }, ref) {
        const localRef = useRef<HTMLInputElement>(null);

        useImperativeHandle(ref, () => ({
            focus: () => localRef.current?.focus(),
        }));

        useEffect(() => {
            if (isFocused) {
                localRef.current?.focus();
            }
        }, [isFocused]);

        return (
            <input
                {...props}
                ref={localRef}
                className={clsx(
                    'block w-full rounded-lg border-line bg-white text-ink shadow-sm',
                    'focus:border-accent focus:ring-accent/40',
                    'placeholder:text-ink-faint disabled:opacity-60',
                    className,
                )}
            />
        );
    },
);
