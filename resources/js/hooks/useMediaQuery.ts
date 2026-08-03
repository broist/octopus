import { useEffect, useState } from 'react';

/**
 * Média-lekérdezés Reactból, a változásra is figyelve.
 *
 * A pusztán induláskor kiolvasott `matchMedia(...).matches` elrontja a
 * forgatást és az ablakátméretezést: a felület a régi elrendezésben ragadna.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(query).matches,
    );

    useEffect(() => {
        const mq = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

        setMatches(mq.matches);
        mq.addEventListener('change', handler);

        return () => mq.removeEventListener('change', handler);
    }, [query]);

    return matches;
}

/** Keskeny képernyő (a Tailwind `lg` töréspontja alatt) — mobil elrendezés. */
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 1023px)');

/** Érintőképernyő (nincs pontos mutató) — más kezelés, nem más elrendezés. */
export const useIsTouch = (): boolean => useMediaQuery('(pointer: coarse)');
