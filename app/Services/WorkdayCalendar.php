<?php

namespace App\Services;

use Carbon\CarbonImmutable;

/**
 * Munkanap-számítás magyar munkaszüneti napokkal.
 *
 * A hétvége (szombat, vasárnap) és a magyar állami ünnepek nem munkanapok.
 * (Az áthelyezett munkanapok/pihenőnapok évente változó rendeletét szándékosan
 * nem modellezzük — a fix + mozgó ünnepek adják a vázat.)
 */
class WorkdayCalendar
{
    /** @var array<int, array<string, string>> év → [Y-m-d => név] gyorsítótár */
    private static array $holidayCache = [];

    /**
     * @return array<string, string>  [Y-m-d => ünnep neve]
     */
    public static function holidays(int $year): array
    {
        if (isset(self::$holidayCache[$year])) {
            return self::$holidayCache[$year];
        }

        // Húsvét (Gauss-algoritmus, gregorián).
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $day = (($h + $l - 7 * $m + 114) % 31) + 1;
        $easter = CarbonImmutable::create($year, $month, $day);

        $h2 = fn (CarbonImmutable $d) => $d->format('Y-m-d');
        $holidays = [
            "{$year}-01-01" => 'Újév',
            "{$year}-03-15" => 'Nemzeti ünnep',
            $h2($easter->subDays(2)) => 'Nagypéntek',
            $h2($easter->addDay()) => 'Húsvéthétfő',
            "{$year}-05-01" => 'A munka ünnepe',
            $h2($easter->addDays(50)) => 'Pünkösdhétfő',
            "{$year}-08-20" => 'Államalapítás ünnepe',
            "{$year}-10-23" => 'Nemzeti ünnep',
            "{$year}-11-01" => 'Mindenszentek',
            "{$year}-12-25" => 'Karácsony',
            "{$year}-12-26" => 'Karácsony másnapja',
        ];

        return self::$holidayCache[$year] = $holidays;
    }

    public static function holidayName(CarbonImmutable $date): ?string
    {
        return self::holidays((int) $date->year)[$date->format('Y-m-d')] ?? null;
    }

    public static function isWeekend(CarbonImmutable $date): bool
    {
        return $date->isWeekend();
    }

    public static function isWorkday(CarbonImmutable $date): bool
    {
        return ! $date->isWeekend() && self::holidayName($date) === null;
    }

    /**
     * Munkanapok száma két dátum között, mindkét végpontot beleértve.
     */
    public static function workdaysBetween(CarbonImmutable $start, CarbonImmutable $end): int
    {
        if ($end->lt($start)) {
            return 0;
        }
        $count = 0;
        $cursor = $start;
        while ($cursor->lte($end)) {
            if (self::isWorkday($cursor)) {
                $count++;
            }
            $cursor = $cursor->addDay();
        }

        return $count;
    }

    /**
     * A(z) $workDays hosszú, $start napon kezdődő szakasz utolsó munkanapja.
     * A kezdőnap az 1. munkanap (ha munkanap); egyébként az első munkanaptól számol.
     */
    public static function endFromStart(CarbonImmutable $start, int $workDays): CarbonImmutable
    {
        $workDays = max(1, $workDays);
        $cursor = self::nextWorkday($start, includeSelf: true);
        $counted = 1;
        while ($counted < $workDays) {
            $cursor = self::nextWorkday($cursor->addDay(), includeSelf: true);
            $counted++;
        }

        return $cursor;
    }

    /**
     * A megadott naptól a következő munkanap (self-t is elfogadja, ha munkanap).
     */
    public static function nextWorkday(CarbonImmutable $date, bool $includeSelf = false): CarbonImmutable
    {
        $cursor = $includeSelf ? $date : $date->addDay();
        while (! self::isWorkday($cursor)) {
            $cursor = $cursor->addDay();
        }

        return $cursor;
    }

    /**
     * $n munkanappal $date után (n lehet negatív).
     */
    public static function addWorkdays(CarbonImmutable $date, int $n): CarbonImmutable
    {
        if ($n === 0) {
            return $date;
        }
        $step = $n > 0 ? 1 : -1;
        $remaining = abs($n);
        $cursor = $date;
        while ($remaining > 0) {
            $cursor = $cursor->addDays($step);
            if (self::isWorkday($cursor)) {
                $remaining--;
            }
        }

        return $cursor;
    }
}
