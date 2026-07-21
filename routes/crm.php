<?php

use App\Http\Controllers\PartnerController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Ügyfelek és partnerek (CRM, 4. modul)
|--------------------------------------------------------------------------
|
| Közös partner-adatbázis (megrendelő / beszállító / alvállalkozó). Minden
| útvonal a crm.* jogosultsághoz kötött.
|
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/crm', [PartnerController::class, 'index'])
        ->middleware('can:crm.view')->name('crm.index');

    Route::post('/crm', [PartnerController::class, 'store'])
        ->middleware('can:crm.create')->name('crm.store');

    Route::get('/crm/{partner}', [PartnerController::class, 'show'])
        ->middleware('can:crm.view')->name('crm.show');

    Route::put('/crm/{partner}', [PartnerController::class, 'update'])
        ->middleware('can:crm.edit')->name('crm.update');

    Route::delete('/crm/{partner}', [PartnerController::class, 'destroy'])
        ->middleware('can:crm.delete')->name('crm.destroy');
});
