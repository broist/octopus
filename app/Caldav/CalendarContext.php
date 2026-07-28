<?php

namespace App\Caldav;

use App\Models\User;

/**
 * A CalDAV-kérés hitelesített felhasználója.
 *
 * A sabre backend-interfészek egy része (pl. getCalendarObjects) nem kapja meg
 * a principalt, ezért a kérés idejére itt tartjuk. Egy CalDAV-kérés rövid
 * életű és egyetlen felhasználót szolgál ki, így ez a kéréshez kötött állapot
 * biztonságos — a CaldavController minden kérés végén törli.
 */
class CalendarContext
{
    private static ?User $user = null;

    public static function set(?User $user): void
    {
        self::$user = $user;
    }

    public static function user(): ?User
    {
        return self::$user;
    }

    public static function clear(): void
    {
        self::$user = null;
    }
}
