import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import FolderTree from '@/Pages/Documents/Partials/FolderTree';
import type { TreeFolder } from '@/types/models';

interface MoveDialogProps {
    open: boolean;
    itemName: string;
    tree: TreeFolder[];
    /** Mozgatott mappa id-ja (önmagába/almappájába nem mozgatható). */
    movingFolderId?: number | null;
    currentLocation: number | null;
    busy?: boolean;
    onMove: (targetId: number | null) => void;
    onClose: () => void;
}

export default function MoveDialog({
    open,
    itemName,
    tree,
    movingFolderId = null,
    currentLocation,
    busy = false,
    onMove,
    onClose,
}: MoveDialogProps) {
    const [target, setTarget] = useState<number | null>(currentLocation);

    useEffect(() => {
        if (open) setTarget(currentLocation);
    }, [open, currentLocation]);

    // Mappa mozgatásánál önmaga és a teljes al-fája tiltott célpont.
    const disabledIds = useMemo(() => {
        if (!movingFolderId) return [];
        const ids = [movingFolderId];
        let added = true;
        while (added) {
            added = false;
            for (const f of tree) {
                if (f.parent_id !== null && ids.includes(f.parent_id) && !ids.includes(f.id)) {
                    ids.push(f.id);
                    added = true;
                }
            }
        }
        return ids;
    }, [movingFolderId, tree]);

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="o-card flex max-h-[80vh] w-full max-w-sm flex-col p-6">
                    <DialogTitle className="text-base font-semibold text-sidebar">
                        Áthelyezés
                    </DialogTitle>
                    <p className="mt-1 truncate text-sm text-ink-soft">„{itemName}" új helye:</p>

                    <div className="mt-3 flex-1 overflow-y-auto rounded-md border border-line bg-cream/40 p-2">
                        <FolderTree
                            tree={tree}
                            selectedId={target}
                            onSelect={setTarget}
                            disabledIds={disabledIds}
                        />
                    </div>

                    <div className="mt-4 flex gap-2">
                        <button
                            className="btn-primary"
                            disabled={busy || target === currentLocation}
                            onClick={() => onMove(target)}
                        >
                            Áthelyezés ide
                        </button>
                        <button className="btn-ghost" onClick={onClose}>
                            Mégse
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
