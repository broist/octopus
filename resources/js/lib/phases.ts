import type { DepType, PhaseItem, ResourceKind } from '@/types/models';

export const DEP_TYPES: { value: DepType; label: string }[] = [
    { value: 'bk', label: 'BK · Befejezés→Kezdés' },
    { value: 'kk', label: 'KK · Kezdés→Kezdés' },
    { value: 'bb', label: 'BB · Befejezés→Befejezés' },
    { value: 'kb', label: 'KB · Kezdés→Befejezés' },
];

export const RESOURCE_KINDS: { value: ResourceKind; label: string }[] = [
    { value: 'kezi', label: 'Kézi erő' },
    { value: 'gepi', label: 'Gépi erő' },
];

/** A fázis hivatkozási száma: sablonból hozott WBS, egyébként sorszám. */
export function phaseRef(phase: Pick<PhaseItem, 'wbs' | 'seq'>): string {
    return phase.wbs ?? String(phase.seq);
}

/** A függőség rövid jelölése, pl. „1.4.2BK+1”. */
export function depNotation(ref: string, type: DepType, lag: number): string {
    const sign = lag > 0 ? `+${lag}` : lag < 0 ? `${lag}` : '';
    return `${ref}${type.toUpperCase()}${sign}`;
}

/** Ütközés-számítás: mely elődökkel fut párhuzamosan (átfedő időszak). */
export function conflictsFor(phase: PhaseItem, byId: Map<number, PhaseItem>): string[] {
    if (!phase.starts_on || !phase.due_on) return [];

    const out: string[] = [];
    for (const dep of phase.dependencies) {
        const pre = byId.get(dep.id);
        if (!pre || !pre.starts_on || !pre.due_on) continue;
        // BK: az utódnak az előd befejezése UTÁN kellene kezdődnie.
        if (dep.type === 'bk' && phase.starts_on <= pre.due_on) {
            out.push(`${phaseRef(pre)} ${pre.name}`);
        }
    }

    return out;
}

/** Ékezet- és kisbetű-független keresés a hosszú sablon-listákhoz. */
export function normalize(value: string): string {
    return value
        .toLocaleLowerCase('hu')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
}

export function phaseMatches(phase: PhaseItem, needle: string): boolean {
    return (
        normalize(phase.name).includes(needle) ||
        (phase.wbs !== null && phase.wbs.startsWith(needle))
    );
}

/**
 * A keresésre illeszkedő sorok azonosítói — a szülőkkel együtt, hogy a
 * találat a fában a helyén, útvonalastól látszódjon.
 */
export function matchingIds(phases: PhaseItem[], needle: string): Set<number> {
    const byId = new Map(phases.map((p) => [p.id, p]));
    const keep = new Set<number>();

    for (const phase of phases) {
        if (!phaseMatches(phase, needle)) continue;

        keep.add(phase.id);
        let parent = phase.parent_id;
        while (parent !== null && !keep.has(parent)) {
            keep.add(parent);
            parent = byId.get(parent)?.parent_id ?? null;
        }
    }

    return keep;
}

/**
 * Hány sort visz el a kijelölés — egy csoport kijelölése a teljes ágát törli.
 * A fázisok mélységi sorrendben állnak, így egy végigfutás elég.
 */
export function selectionSize(phases: PhaseItem[], selected: Set<number>): number {
    let insideLevel: number | null = null;
    let count = 0;

    for (const phase of phases) {
        if (insideLevel !== null && phase.level > insideLevel) {
            count++;
            continue;
        }
        insideLevel = null;

        if (selected.has(phase.id)) {
            count++;
            if (phase.is_group) insideLevel = phase.level;
        }
    }

    return count;
}
