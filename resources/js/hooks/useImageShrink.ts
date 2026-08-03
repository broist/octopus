import { useCallback, useState } from 'react';
import { hasShrinkable, shrinkImages } from '@/lib/image';

export interface ShrinkProgress {
    done: number;
    total: number;
}

/**
 * Fájlválasztás után a képeket még a küldés előtt kicsinyíti a böngészőben.
 *
 * Minden olyan űrlapon ezt használjuk, ahol fotó kerülhet fel (napi jelentés,
 * hibafotó, új dokumentum-verzió): telefonról egy kép 4–12 MB, kicsinyítve
 * néhány száz kilobájt — ez a különbség mobilhálózaton percekben mérhető.
 */
export function useImageShrink() {
    const [preparing, setPreparing] = useState<ShrinkProgress | null>(null);

    const prepare = useCallback(async (files: File[]): Promise<File[]> => {
        if (files.length === 0 || !hasShrinkable(files)) return files;

        setPreparing({ done: 0, total: files.length });

        try {
            const result = await shrinkImages(files, {}, (done, total) =>
                setPreparing({ done, total }),
            );

            return result.files;
        } finally {
            setPreparing(null);
        }
    }, []);

    return { prepare, preparing };
}
