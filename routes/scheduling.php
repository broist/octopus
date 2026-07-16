<?php

use App\Http\Controllers\SchedulingController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Ütemezés / Naptár (3. modul)
|--------------------------------------------------------------------------
| A route-middleware a modul-belépést őrzi; a személyes bejegyzések és a
| szerkesztési jogok finomhangolását a controller végzi.
*/

Route::middleware(['auth', 'can:scheduling.view'])->group(function () {
    Route::get('/scheduling', [SchedulingController::class, 'index'])
        ->name('scheduling.index');

    Route::post('/scheduling/events', [SchedulingController::class, 'store'])
        ->name('scheduling.events.store');

    Route::put('/scheduling/events/{event}', [SchedulingController::class, 'update'])
        ->name('scheduling.events.update');

    Route::delete('/scheduling/events/{event}', [SchedulingController::class, 'destroy'])
        ->name('scheduling.events.destroy');
});
