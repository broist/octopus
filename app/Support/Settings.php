<?php

namespace App\Support;

use App\Models\AppSetting;

/**
 * Vékony olvasó/író az app_settings tábla fölé.
 *
 * Az érték JSON-ként tárolódik, ezért a `{"v": …}` burkolás miatt skalár is
 * mehet bele. Kérésenként egyszer olvas (statikus gyorsítótár).
 */
class Settings
{
    /** @var array<string, mixed> */
    private static array $cache = [];

    private static bool $loaded = false;

    public static function get(string $key, mixed $default = null): mixed
    {
        self::load();

        return array_key_exists($key, self::$cache) ? self::$cache[$key] : $default;
    }

    public static function set(string $key, mixed $value): void
    {
        AppSetting::updateOrCreate(['key' => $key], ['value' => ['v' => $value]]);

        self::load();
        self::$cache[$key] = $value;
    }

    public static function forget(string $key): void
    {
        AppSetting::where('key', $key)->delete();

        self::load();
        unset(self::$cache[$key]);
    }

    /** Teszteléshez / hosszan futó folyamatokhoz. */
    public static function flush(): void
    {
        self::$cache = [];
        self::$loaded = false;
    }

    private static function load(): void
    {
        if (self::$loaded) {
            return;
        }

        self::$cache = AppSetting::all()
            ->mapWithKeys(fn (AppSetting $s) => [$s->key => $s->value['v'] ?? null])
            ->all();
        self::$loaded = true;
    }
}
