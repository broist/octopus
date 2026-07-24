import {
    Cloud,
    CloudDrizzle,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSnow,
    CloudSun,
    Droplets,
    Sun,
    Thermometer,
    Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WeatherIcon, WeatherSnapshot } from '@/types/models';

const ICONS: Record<WeatherIcon, LucideIcon> = {
    sun: Sun,
    partly: CloudSun,
    cloud: Cloud,
    fog: CloudFog,
    drizzle: CloudDrizzle,
    rain: CloudRain,
    snow: CloudSnow,
    storm: CloudLightning,
};

export function WeatherGlyph({ weather, size = 16 }: { weather: WeatherSnapshot; size?: number }) {
    const Icon = ICONS[weather.icon] ?? Cloud;
    return <Icon size={size} />;
}

/** Kompakt időjárás-jelvény (lista). */
export function WeatherChip({ weather }: { weather: WeatherSnapshot }) {
    return (
        <span className="inline-flex items-center gap-1 text-xs text-ink-soft" title={weather.label}>
            <WeatherGlyph weather={weather} size={14} />
            {weather.temp_max != null && (
                <span className="font-medium text-ink">{Math.round(weather.temp_max)}°</span>
            )}
        </span>
    );
}

/** Részletes időjárás-kártya (adatlap). */
export function WeatherCard({ weather }: { weather: WeatherSnapshot }) {
    return (
        <div className="o-card flex items-center gap-4 p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent">
                <WeatherGlyph weather={weather} size={26} />
            </span>
            <div className="min-w-0">
                <div className="text-sm font-semibold text-sidebar">{weather.label}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                    {(weather.temp_max != null || weather.temp_min != null) && (
                        <span className="inline-flex items-center gap-1">
                            <Thermometer size={12} />
                            {weather.temp_max != null ? `${Math.round(weather.temp_max)}°` : '–'}
                            {' / '}
                            {weather.temp_min != null ? `${Math.round(weather.temp_min)}°` : '–'}
                        </span>
                    )}
                    {weather.precipitation != null && (
                        <span className="inline-flex items-center gap-1">
                            <Droplets size={12} />
                            {weather.precipitation} mm
                        </span>
                    )}
                    {weather.wind_max != null && (
                        <span className="inline-flex items-center gap-1">
                            <Wind size={12} />
                            {Math.round(weather.wind_max)} km/h
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
