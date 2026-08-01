<?php

use App\Http\Controllers\ClientPortalAccessController;
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

    /*
    | Ügyfélportál-hozzáférés a megrendelőnek. Fiókot érint, ezért a
    | Felhasználók modul jogaihoz kötött — a CRM-ben csak a helye van.
    */
    Route::post('/crm/{partner}/portal', [ClientPortalAccessController::class, 'store'])
        ->middleware('can:users.create')->name('crm.portal.store');

    Route::put('/crm/{partner}/portal/{user}', [ClientPortalAccessController::class, 'update'])
        ->middleware('can:users.edit')->name('crm.portal.update');

    Route::delete('/crm/{partner}/portal/{user}', [ClientPortalAccessController::class, 'destroy'])
        ->middleware('can:users.delete')->name('crm.portal.destroy');
});
