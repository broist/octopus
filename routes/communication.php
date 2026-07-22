<?php

use App\Http\Controllers\CommunicationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Kommunikáció (14. modul) — belső üzenőfal
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/communication', [CommunicationController::class, 'index'])
        ->middleware('can:communication.view')->name('communication.index');

    Route::post('/communication', [CommunicationController::class, 'store'])
        ->middleware('can:communication.create')->name('communication.store');

    Route::delete('/communication/{announcement}', [CommunicationController::class, 'destroy'])
        ->middleware('can:communication.view')->name('communication.destroy');
});
