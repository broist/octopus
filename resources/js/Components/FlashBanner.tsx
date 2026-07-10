import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { usePageProps } from '@/hooks/usePageProps';

export default function FlashBanner() {
    const { flash } = usePageProps();
    const [dismissed, setDismissed] = useState(false);

    const message = flash.success ?? flash.error ?? flash.info ?? null;
    const kind = flash.success ? 'success' : flash.error ? 'error' : 'info';

    useEffect(() => {
        setDismissed(false);
    }, [message]);

    if (!message || dismissed) {
        return null;
    }

    const styles = {
        success: 'bg-accent-50 text-accent-700 border-accent-100',
        error: 'border-coral/30 bg-coral/10 text-[#9c3d2b]',
        info: 'border-amberwarn/30 bg-amberwarn/10 text-[#8a5e17]',
    }[kind];

    const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info }[kind];

    return (
        <div
            className={`mb-4 flex items-start gap-2 rounded-card border px-4 py-3 text-sm ${styles}`}
        >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1">{message}</span>
            <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Bezárás"
                className="rounded p-0.5 hover:bg-black/5"
            >
                <X size={16} />
            </button>
        </div>
    );
}
