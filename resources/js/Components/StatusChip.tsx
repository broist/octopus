import clsx from 'clsx';
import type { ProjectStatus } from '@/types/models';

const CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
    ajanlat: { label: 'Ajánlati fázis', className: 'chip-amber' },
    szerzodott: { label: 'Szerződött', className: 'chip-grey' },
    folyamatban: { label: 'Folyamatban', className: 'chip-green' },
    atadas: { label: 'Átadás', className: 'chip-green' },
    lezart: { label: 'Lezárt', className: 'chip-grey' },
};

export default function StatusChip({
    status,
    className,
}: {
    status: ProjectStatus;
    className?: string;
}) {
    const cfg = CONFIG[status] ?? { label: status, className: 'chip-grey' };

    return <span className={clsx('chip', cfg.className, className)}>{cfg.label}</span>;
}

export function SlippingChip({ className }: { className?: string }) {
    return <span className={clsx('chip chip-coral', className)}>Csúszik</span>;
}
