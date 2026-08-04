import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { thumbUrl } from '@/lib/documents';

/** A nézegetőnek elég ennyi egy képről (az ExplorerFileRow ezt kielégíti). */
export interface LightboxImage {
    id: number;
    title: string;
    original_filename: string | null;
    preview_version_id: number | null;
    has_thumb: boolean;
    download_version_id: number | null;
}

interface Props {
    images: LightboxImage[];
    /** A megnyitott kép sorszáma; `null` esetén a nézegető zárva van. */
    index: number | null;
    onIndex: (index: number) => void;
    onClose: () => void;
}

const MAX_ZOOM = 6;
/** Dupla koppintás / dupla kattintás erre a nagyításra ugrik. */
const STEP_ZOOM = 2.5;
/** Ennyi képpont vízszintes húzás számít lapozásnak (1x nagyításnál). */
const SWIPE_PX = 60;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function previewUrl(image: LightboxImage): string {
    return route('documents.versions.preview', image.preview_version_id as number);
}

/**
 * Teljes képernyős képnézegető a Fájlkezelőhöz — asztali és mobil nézetben
 * ugyanaz a komponens.
 *
 * Lapozás: nyílbillentyűk, oldalsó gombok, mobilon vízszintes húzás.
 * Nagyítás: görgő (a kurzor köré), csippentés, dupla koppintás; nagyításban a
 * húzás pásztáz, ilyenkor a lapozó húzás ki van kapcsolva.
 *
 * Sávszélesség: alapból az 1200 px-es bélyegkép jelenik meg (töredéke az
 * eredetinek), és csak nagyításkor töltjük be fölé az eredeti felbontású képet
 * — így a részletek élesek, de a lapozás gyors marad.
 */
export default function ImageLightbox({ images, index, onIndex, onClose }: Props) {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [fullLoaded, setFullLoaded] = useState(false);

    const frameRef = useRef<HTMLDivElement>(null);
    /** Az aktív érintések/egérgombok — a csippentéshez kell kettő. */
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const gesture = useRef<{ startX: number; dist: number; zoom: number; moved: boolean } | null>(null);
    const lastTap = useRef(0);

    const image = index !== null ? images[index] : undefined;
    const open = image !== undefined && image.preview_version_id !== null;

    const reset = useCallback(() => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setFullLoaded(false);
    }, []);

    // Képváltáskor a nagyítás mindig alaphelyzetbe áll.
    useEffect(reset, [index, reset]);

    const step = useCallback(
        (delta: number) => {
            if (index === null || images.length < 2) return;
            onIndex((index + delta + images.length) % images.length);
        },
        [index, images.length, onIndex],
    );

    // Billentyűzet + a háttér görgetésének tiltása, amíg a nézegető nyitva van.
    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') step(-1);
            else if (e.key === 'ArrowRight') step(1);
            else if (e.key === '0') reset();
        };

        window.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [open, onClose, step, reset]);

    if (!open || !image) return null;

    const thumbSrc = image.has_thumb
        ? thumbUrl(image.preview_version_id as number, 1200)
        : previewUrl(image);
    const showFull = zoom > 1 && image.has_thumb;

    /** Nagyítás egy adott képernyőpont körül, hogy az a pont a helyén maradjon. */
    const zoomAround = (nextZoom: number, clientX: number, clientY: number) => {
        const frame = frameRef.current;
        if (!frame) return;

        const rect = frame.getBoundingClientRect();
        const cx = clientX - rect.left - rect.width / 2;
        const cy = clientY - rect.top - rect.height / 2;

        setZoom((current) => {
            const next = clamp(nextZoom, 1, MAX_ZOOM);
            const ratio = next / current;
            setOffset((o) =>
                next === 1
                    ? { x: 0, y: 0 }
                    : {
                          x: cx - (cx - o.x) * ratio,
                          y: cy - (cy - o.y) * ratio,
                      },
            );

            return next;
        });
    };

    const toggleZoom = (clientX: number, clientY: number) => {
        if (zoom > 1) reset();
        else zoomAround(STEP_ZOOM, clientX, clientY);
    };

    const onPointerDown = (e: React.PointerEvent) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const points = [...pointers.current.values()];
        gesture.current = {
            startX: e.clientX,
            dist: points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
            zoom,
            moved: false,
        };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!pointers.current.has(e.pointerId)) return;

        const previous = pointers.current.get(e.pointerId)!;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const points = [...pointers.current.values()];
        const g = gesture.current;
        if (!g) return;

        // Két ujj: csippentés.
        if (points.length === 2 && g.dist > 0) {
            const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            g.moved = true;
            zoomAround(
                g.zoom * (dist / g.dist),
                (points[0].x + points[1].x) / 2,
                (points[0].y + points[1].y) / 2,
            );

            return;
        }

        if (points.length !== 1) return;

        const dx = e.clientX - previous.x;
        const dy = e.clientY - previous.y;
        if (Math.abs(e.clientX - g.startX) > 6) g.moved = true;

        // Nagyításban a húzás pásztáz; alaphelyzetben a lapozásra tartogatjuk.
        if (zoom > 1) {
            setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
        }
    };

    const onPointerUp = (e: React.PointerEvent) => {
        const start = gesture.current;
        const point = pointers.current.get(e.pointerId);
        pointers.current.delete(e.pointerId);

        if (!start || !point) return;
        if (pointers.current.size > 0) return; // csippentés közben még van ujj a képen

        // Lapozó húzás csak alaphelyzetben.
        if (zoom === 1) {
            const dx = e.clientX - start.startX;
            if (Math.abs(dx) > SWIPE_PX) {
                step(dx < 0 ? 1 : -1);
                gesture.current = null;

                return;
            }
        }

        // Dupla koppintás / kattintás: nagyítás váltása.
        if (!start.moved) {
            const now = Date.now();
            if (now - lastTap.current < 300) {
                toggleZoom(e.clientX, e.clientY);
                lastTap.current = 0;
            } else {
                lastTap.current = now;
            }
        }

        gesture.current = null;
    };

    const onWheel = (e: React.WheelEvent) => {
        zoomAround(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
    };

    const name = image.original_filename || image.title;

    return (
        <div
            className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-black/95"
            role="dialog"
            aria-modal="true"
            aria-label={name}
        >
            {/* Fejléc: név, sorszám, letöltés, bezárás */}
            <header className="flex shrink-0 items-center gap-3 px-3 py-2 text-white sm:px-4 sm:py-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    {images.length > 1 && (
                        <p className="text-xs text-white/60">
                            {(index as number) + 1} / {images.length}
                        </p>
                    )}
                </div>

                {zoom > 1 && (
                    <button
                        type="button"
                        onClick={reset}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                )}

                {image.download_version_id && (
                    <a
                        href={route('documents.versions.download', image.download_version_id)}
                        className="rounded-lg p-2.5 text-white/80 hover:bg-white/10 hover:text-white"
                        title="Letöltés"
                        aria-label="Letöltés"
                    >
                        <Download size={20} />
                    </a>
                )}

                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2.5 text-white/80 hover:bg-white/10 hover:text-white"
                    title="Bezárás (Esc)"
                    aria-label="Bezárás"
                >
                    <X size={20} />
                </button>
            </header>

            {/* Képterület */}
            <div
                ref={frameRef}
                className="relative min-h-0 flex-1 select-none overflow-hidden"
                style={{ touchAction: 'none', cursor: zoom > 1 ? 'grab' : 'default' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={onWheel}
                onDoubleClick={(e) => toggleZoom(e.clientX, e.clientY)}
            >
                <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transition: gesture.current ? 'none' : 'transform 120ms ease-out',
                    }}
                >
                    <img
                        src={thumbSrc}
                        alt={name}
                        draggable={false}
                        className="max-h-full max-w-full object-contain"
                    />
                    {/* Nagyításkor az eredeti felbontás úszik be a bélyegkép fölé. */}
                    {showFull && (
                        <img
                            src={previewUrl(image)}
                            alt=""
                            aria-hidden
                            draggable={false}
                            onLoad={() => setFullLoaded(true)}
                            className="absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity duration-200"
                            style={{ opacity: fullLoaded ? 1 : 0 }}
                        />
                    )}
                </div>

                {/* Lapozás */}
                {images.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => step(-1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white/90 backdrop-blur transition hover:bg-black/70 hover:text-white sm:left-4"
                            title="Előző (←)"
                            aria-label="Előző kép"
                        >
                            <ChevronLeft size={26} />
                        </button>
                        <button
                            type="button"
                            onClick={() => step(1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white/90 backdrop-blur transition hover:bg-black/70 hover:text-white sm:right-4"
                            title="Következő (→)"
                            aria-label="Következő kép"
                        >
                            <ChevronRight size={26} />
                        </button>
                    </>
                )}
            </div>

            <footer className="shrink-0 pb-[env(safe-area-inset-bottom)] pt-1 text-center text-[11px] text-white/40">
                <span className="hidden sm:inline">
                    Nyilak: lapozás · Görgő vagy dupla kattintás: nagyítás · Esc: bezárás
                </span>
                <span className="sm:hidden">Húzás: lapozás · Csippentés vagy dupla koppintás: nagyítás</span>
            </footer>
        </div>
    );
}
