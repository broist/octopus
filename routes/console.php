<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Ajánlatkérő e-mailek beolvasása (acuwall.hu űrlap → projekt + értesítés).
// Amíg a LEADS_IMAP_* nincs kitöltve, a parancs azonnal, csendben kilép.
Schedule::command('leads:fetch')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();
