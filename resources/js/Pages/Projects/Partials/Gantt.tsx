import { useMemo } from 'react';
import type { PhaseItem } from '@/types/models';

const MS_PER_DAY = 86_400_000;
const LABEL_W = 190;
const ROW_H = 36;
const HEADER_H = 34;
const BAR_H = 18;

const monthFmt = new Intl.DateTimeFormat('hu-HU', { month: 'short' });

function parseDate(value: string): Date {
    return new Date(`${value}T00:00:00`);
}

interface Row {
    phase: PhaseItem;
    start: Date;
    end: Date;
    overdue: boolean;
    done: boolean;
}

interface Overlap {
    from: Date;
    to: Date;
}

/**
 * Könnyű, saját SVG Gantt: fázisok idővonalon, készültség-kitöltéssel,
 * függőség-nyilakkal, "ma" vonallal. Csúszó fázis korallal jelölve (spec §6).
 */
export default function Gantt({ phases }: { phases: PhaseItem[] }) {
    const model = useMemo(() => {
        const rows: Row[] = phases
            .filter((p) => p.starts_on && p.due_on)
            .map((p) => ({
                phase: p,
                start: parseDate(p.starts_on as string),
                end: parseDate(p.due_on as string),
                overdue: p.is_overdue,
                done: p.progress >= 100,
            }));

        if (rows.length === 0) return null;

        const min = new Date(
            Math.min(...rows.map((r) => r.start.getTime())) - 3 * MS_PER_DAY,
        );
        const max = new Date(Math.max(...rows.map((r) => r.end.getTime())) + 4 * MS_PER_DAY);
        const days = Math.max(1, Math.round((max.getTime() - min.getTime()) / MS_PER_DAY));
        const dayW = days <= 70 ? 18 : days <= 180 ? 9 : 5;

        // Ütközések: BK-függőségnél az utód az előd befejezése előtt/alatt indul,
        // tehát a két szakasz átfed → párhuzamos munkavégzés az adott napokon.
        const byId = new Map(rows.map((r) => [r.phase.id, r]));
        const overlaps: Overlap[] = [];
        for (const r of rows) {
            for (const dep of r.phase.dependencies ?? []) {
                if (dep.type !== 'bk') continue;
                const pre = byId.get(dep.id);
                if (!pre) continue;
                if (r.start.getTime() <= pre.end.getTime()) {
                    overlaps.push({
                        from: r.start,
                        to: new Date(Math.min(r.end.getTime(), pre.end.getTime())),
                    });
                }
            }
        }

        return { rows, min, max, days, dayW, overlaps };
    }, [phases]);

    if (!model) {
        return (
            <div className="rounded-card border border-dashed border-line bg-cream/60 px-4 py-8 text-center text-sm text-ink-faint">
                A Gantt-nézethez adjon meg kezdést és határidőt a fázisoknál.
            </div>
        );
    }

    const { rows, min, max, days, dayW, overlaps } = model;
    const width = LABEL_W + days * dayW + 16;
    const height = HEADER_H + rows.length * ROW_H + 8;

    const x = (d: Date) =>
        LABEL_W + ((d.getTime() - min.getTime()) / MS_PER_DAY) * dayW;

    // Hónap-rácsvonalak
    const months: { x: number; label: string }[] = [];
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cursor <= max) {
        if (cursor >= min) {
            months.push({
                x: x(cursor),
                label:
                    cursor.getMonth() === 0
                        ? `${cursor.getFullYear()}. ${monthFmt.format(cursor)}`
                        : monthFmt.format(cursor),
            });
        }
        cursor.setMonth(cursor.getMonth() + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayX = today >= min && today <= max ? x(today) : null;

    const rowIndex = new Map(rows.map((r, i) => [r.phase.id, i]));
    const rowCenterY = (i: number) => HEADER_H + i * ROW_H + ROW_H / 2;

    return (
        <div className="o-card overflow-x-auto p-4">
            <svg width={width} height={height} className="block" role="img" aria-label="Gantt ütemterv">
                <defs>
                    <marker
                        id="gantt-arrow"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                    >
                        <path d="M 0 0 L 8 4 L 0 8 z" fill="#8a8a7e" />
                    </marker>
                </defs>

                {/* Hónap-rács */}
                {months.map((m, i) => (
                    <g key={i}>
                        <line
                            x1={m.x}
                            x2={m.x}
                            y1={HEADER_H - 8}
                            y2={height}
                            stroke="#EAE5DB"
                            strokeWidth={1}
                        />
                        <text x={m.x + 4} y={16} fontSize={11} fill="#8a8a7e">
                            {m.label}
                        </text>
                    </g>
                ))}

                {/* Ütközés-sávok (párhuzamos munkavégzés / átfedő szakaszok) */}
                {overlaps.map((o, i) => {
                    const bx = x(o.from);
                    const bw = Math.max(x(new Date(o.to.getTime() + MS_PER_DAY)) - bx, 2);
                    return (
                        <g key={`ov-${i}`}>
                            <rect
                                x={bx}
                                y={HEADER_H - 8}
                                width={bw}
                                height={height - HEADER_H + 8}
                                fill="rgba(192,80,58,0.14)"
                            />
                            <line x1={bx} x2={bx} y1={HEADER_H - 8} y2={height} stroke="#C0503A" strokeWidth={1} strokeDasharray="2 2" />
                            <line x1={bx + bw} x2={bx + bw} y1={HEADER_H - 8} y2={height} stroke="#C0503A" strokeWidth={1} strokeDasharray="2 2" />
                        </g>
                    );
                })}

                {/* Sorok elválasztói + nevek */}
                {rows.map((r, i) => {
                    const y = HEADER_H + i * ROW_H;
                    const label = `${r.phase.seq}. ${r.phase.name}`;
                    const name = label.length > 26 ? `${label.slice(0, 25)}…` : label;
                    return (
                        <g key={r.phase.id}>
                            <line
                                x1={0}
                                x2={width}
                                y1={y}
                                y2={y}
                                stroke="#EAE5DB"
                                strokeWidth={i === 0 ? 1 : 0.5}
                            />
                            <text
                                x={6}
                                y={rowCenterY(i) + 4}
                                fontSize={12}
                                fontWeight={500}
                                fill={r.overdue ? '#C0503A' : '#2b2b28'}
                            >
                                {name}
                            </text>
                        </g>
                    );
                })}

                {/* Függőség-nyilak */}
                {rows.map((r) =>
                    r.phase.depends_on.map((depId) => {
                        const fromIdx = rowIndex.get(depId);
                        const toIdx = rowIndex.get(r.phase.id);
                        if (fromIdx === undefined || toIdx === undefined) return null;
                        const from = rows[fromIdx];
                        const x1 = x(new Date(from.end.getTime() + MS_PER_DAY));
                        const y1 = rowCenterY(fromIdx);
                        const x2 = x(r.start) - 3;
                        const y2 = rowCenterY(toIdx);
                        const midX = Math.max(x1 + 6, x2 - 8);
                        return (
                            <path
                                key={`${depId}-${r.phase.id}`}
                                d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
                                fill="none"
                                stroke="#8a8a7e"
                                strokeWidth={1.2}
                                markerEnd="url(#gantt-arrow)"
                                opacity={0.8}
                            />
                        );
                    }),
                )}

                {/* Fázis-sávok */}
                {rows.map((r, i) => {
                    const xs = x(r.start);
                    const xe = x(new Date(r.end.getTime() + MS_PER_DAY));
                    const w = Math.max(xe - xs, 6);
                    const y = rowCenterY(i) - BAR_H / 2;
                    const track = r.overdue
                        ? 'rgba(192,80,58,0.22)'
                        : 'rgba(46,107,79,0.20)';
                    const fill = r.overdue ? '#C0503A' : '#2E6B4F';

                    return (
                        <g key={r.phase.id}>
                            <rect x={xs} y={y} width={w} height={BAR_H} rx={2} fill={track} />
                            {r.phase.progress > 0 && (
                                <rect
                                    x={xs}
                                    y={y}
                                    width={(w * Math.min(r.phase.progress, 100)) / 100}
                                    height={BAR_H}
                                    rx={2}
                                    fill={fill}
                                />
                            )}
                            <text
                                x={xe + 6}
                                y={y + BAR_H - 5}
                                fontSize={10.5}
                                fill={r.overdue ? '#C0503A' : '#8a8a7e'}
                            >
                                {r.phase.progress}%
                            </text>
                        </g>
                    );
                })}

                {/* Ma vonal */}
                {todayX !== null && (
                    <g>
                        <line
                            x1={todayX}
                            x2={todayX}
                            y1={HEADER_H - 8}
                            y2={height}
                            stroke="#C0503A"
                            strokeWidth={1.4}
                            strokeDasharray="4 3"
                        />
                        <text
                            x={todayX + 4}
                            y={HEADER_H - 12}
                            fontSize={10}
                            fontWeight={600}
                            fill="#C0503A"
                        >
                            ma
                        </text>
                    </g>
                )}
            </svg>

            {/* Jelmagyarázat */}
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-xs text-ink-soft">
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-5 rounded-sm bg-accent" /> Készültség
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-5 rounded-sm bg-accent/20" /> Hátralévő
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-5 rounded-sm bg-coral" /> Csúszásban
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-px border-l border-dashed border-coral" />{' '}
                    Mai nap
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-5 rounded-sm bg-coral/20" /> Ütközés / párhuzam
                </span>
            </div>
        </div>
    );
}
