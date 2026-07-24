<?php

use App\Http\Controllers\DailyReportController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Napi jelentés / Munkanapló (11. modul)
|--------------------------------------------------------------------------
|
| Az építési napló digitális megfelelője: projektenként naponta egy helyszíni
| bejegyzés (elvégzett munka, akadályok, létszám, anyag-/gépmozgás, fotók,
| automatikus időjárás). Minden útvonal a daily-reports.* jogosultsághoz kötött.
|
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/daily-reports', [DailyReportController::class, 'index'])
        ->middleware('can:daily-reports.view')->name('daily-reports.index');

    Route::get('/daily-reports/create', [DailyReportController::class, 'create'])
        ->middleware('can:daily-reports.create')->name('daily-reports.create');

    Route::post('/daily-reports', [DailyReportController::class, 'store'])
        ->middleware('can:daily-reports.create')->name('daily-reports.store');

    Route::get('/daily-reports/{dailyReport}', [DailyReportController::class, 'show'])
        ->middleware('can:daily-reports.view')->name('daily-reports.show');

    Route::get('/daily-reports/{dailyReport}/edit', [DailyReportController::class, 'edit'])
        ->middleware('can:daily-reports.edit')->name('daily-reports.edit');

    Route::put('/daily-reports/{dailyReport}', [DailyReportController::class, 'update'])
        ->middleware('can:daily-reports.edit')->name('daily-reports.update');

    Route::delete('/daily-reports/{dailyReport}', [DailyReportController::class, 'destroy'])
        ->middleware('can:daily-reports.delete')->name('daily-reports.destroy');

    Route::post('/daily-reports/{dailyReport}/weather', [DailyReportController::class, 'refresh'])
        ->middleware('can:daily-reports.edit')->name('daily-reports.weather');

    // Helyszíni fotó megjelenítése (galéria) — a daily-reports.view jog elég.
    Route::get('/daily-report-photos/{photo}', [DailyReportController::class, 'photo'])
        ->middleware('can:daily-reports.view')->name('daily-reports.photos.show');
});
