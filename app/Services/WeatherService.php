<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Időjárás-lekérdezés a Napi jelentés / Munkanapló modulhoz (spec §11): a
 * helyszín (projekt-koordináták) alapján automatikusan lekért napi időjárás —
 * kézzel nem kell beírni. Alap-szolgáltató az Open-Meteo (ingyenes, API-kulcs
 * nélkül; a config/services.php `weather` bejegyzésével cserélhető).
 *
 * A hívás sosem törheti meg a mentést: hiba / hiányzó koordináta esetén null-t
 * ad vissza, a napi jelentés időjárás nélkül is elmenthető.
 */
class WeatherService
{
    private const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

    /**
     * Egy adott dátum és koordináta napi időjárás-pillanatképe.
     *
     * @return array<string, mixed>|null
     */
    public function forDate(?float $latitude, ?float $longitude, string $date): ?array
    {
        if ($latitude === null || $longitude === null) {
            return null;
        }

        try {
            $response = Http::timeout(6)->retry(1, 200)->get(self::ENDPOINT, [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'daily' => 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
                'timezone' => 'Europe/Budapest',
                'start_date' => $date,
                'end_date' => $date,
            ]);

            if ($response->failed()) {
                return null;
            }

            $daily = $response->json('daily');
            if (! is_array($daily) || empty($daily['time'][0])) {
                return null;
            }

            $code = (int) ($daily['weather_code'][0] ?? 0);

            return [
                'provider' => 'open-meteo',
                'date' => $daily['time'][0],
                'code' => $code,
                'label' => self::describe($code),
                'icon' => self::icon($code),
                'temp_max' => self::num($daily['temperature_2m_max'][0] ?? null),
                'temp_min' => self::num($daily['temperature_2m_min'][0] ?? null),
                'precipitation' => self::num($daily['precipitation_sum'][0] ?? null),
                'wind_max' => self::num($daily['wind_speed_10m_max'][0] ?? null),
            ];
        } catch (\Throwable $e) {
            Log::warning('Időjárás lekérés sikertelen: '.$e->getMessage());

            return null;
        }
    }

    private static function num(mixed $value): ?float
    {
        return $value === null ? null : round((float) $value, 1);
    }

    /**
     * WMO időjárás-kód → magyar leírás (spec §11: automatikus időjárás).
     */
    public static function describe(int $code): string
    {
        return match (true) {
            $code === 0 => 'Derült',
            $code === 1 => 'Túlnyomóan derült',
            $code === 2 => 'Gomolyfelhős',
            $code === 3 => 'Borult',
            in_array($code, [45, 48], true) => 'Köd',
            in_array($code, [51, 53, 55], true) => 'Szitálás',
            in_array($code, [56, 57], true) => 'Ónos szitálás',
            in_array($code, [61, 63, 65], true) => 'Eső',
            in_array($code, [66, 67], true) => 'Ónos eső',
            in_array($code, [71, 73, 75, 77], true) => 'Havazás',
            in_array($code, [80, 81, 82], true) => 'Zápor',
            in_array($code, [85, 86], true) => 'Hózápor',
            $code === 95 => 'Zivatar',
            in_array($code, [96, 99], true) => 'Zivatar jégesővel',
            default => 'Ismeretlen',
        };
    }

    /**
     * WMO kód → ikonkulcs a frontendnek (lucide ikon választáshoz).
     */
    public static function icon(int $code): string
    {
        return match (true) {
            $code === 0, $code === 1 => 'sun',
            $code === 2 => 'partly',
            $code === 3 => 'cloud',
            in_array($code, [45, 48], true) => 'fog',
            in_array($code, [51, 53, 55, 56, 57], true) => 'drizzle',
            in_array($code, [61, 63, 65, 66, 67, 80, 81, 82], true) => 'rain',
            in_array($code, [71, 73, 75, 77, 85, 86], true) => 'snow',
            in_array($code, [95, 96, 99], true) => 'storm',
            default => 'cloud',
        };
    }
}
