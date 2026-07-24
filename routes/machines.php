<?php

use App\Http\Controllers\MachineController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Gépek és eszközök (7. modul)
|--------------------------------------------------------------------------
|
| Géppark-nyilvántartás: törzsadat + státusz/hely + felelős; karbantartás
| (esedékes szerviz, műszaki vizsga) lejárati figyelmeztetéssel; karbantartási
| előzmény; foglalás a naptárhoz kötve ütközés-jelzéssel; dokumentumok.
| Minden útvonal a machines.* jogosultsághoz kötött.
|
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/machines', [MachineController::class, 'index'])
        ->middleware('can:machines.view')->name('machines.index');

    Route::post('/machines', [MachineController::class, 'store'])
        ->middleware('can:machines.create')->name('machines.store');

    Route::get('/machines/{machine}', [MachineController::class, 'show'])
        ->middleware('can:machines.view')->name('machines.show');

    Route::put('/machines/{machine}', [MachineController::class, 'update'])
        ->middleware('can:machines.edit')->name('machines.update');

    Route::delete('/machines/{machine}', [MachineController::class, 'destroy'])
        ->middleware('can:machines.delete')->name('machines.destroy');

    // --- Karbantartási előzmény ---
    Route::post('/machines/{machine}/maintenances', [MachineController::class, 'storeMaintenance'])
        ->middleware('can:machines.edit')->name('machines.maintenances.store');

    Route::get('/machine-maintenances/{maintenance}/download', [MachineController::class, 'downloadMaintenance'])
        ->middleware('can:machines.view')->name('machines.maintenances.download');

    Route::delete('/machine-maintenances/{maintenance}', [MachineController::class, 'destroyMaintenance'])
        ->middleware('can:machines.edit')->name('machines.maintenances.destroy');

    // --- Dokumentumok ---
    Route::post('/machines/{machine}/documents', [MachineController::class, 'storeDocument'])
        ->middleware('can:machines.edit')->name('machines.documents.store');

    Route::get('/machine-documents/{document}/download', [MachineController::class, 'downloadDocument'])
        ->middleware('can:machines.view')->name('machines.documents.download');

    Route::delete('/machine-documents/{document}', [MachineController::class, 'destroyDocument'])
        ->middleware('can:machines.edit')->name('machines.documents.destroy');

    // --- Foglalás ---
    Route::post('/machines/{machine}/bookings', [MachineController::class, 'storeBooking'])
        ->middleware('can:machines.edit')->name('machines.bookings.store');

    Route::delete('/machine-bookings/{booking}', [MachineController::class, 'destroyBooking'])
        ->middleware('can:machines.edit')->name('machines.bookings.destroy');
});
