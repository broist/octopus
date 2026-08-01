<?php

use App\Http\Controllers\ClientPortalController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Ügyfélportál (külső megrendelői fiókok)
|--------------------------------------------------------------------------
|
| A `portal` middleware enged be: külső, aktív, partnerhez kötött fiók. Innen
| nincs átjárás a belső alkalmazásba (RedirectExternalUsers), és a portál sem
| használ modul-jogosultságokat — minden lekérdezés a fiók partneréből indul,
| és csak a kifejezetten megosztott (`client_visible`) tartalmat adja vissza.
|
*/

Route::middleware(['auth', 'portal'])->prefix('ugyfel')->name('ugyfel.')->group(function () {
    Route::get('/', [ClientPortalController::class, 'index'])->name('index');

    Route::get('/fiok', [ClientPortalController::class, 'account'])->name('fiok');

    Route::get('/projekt/{project}', [ClientPortalController::class, 'project'])
        ->whereNumber('project')->name('projekt');

    // Megosztott dokumentum letöltése / előnézete
    Route::get('/fajl/{version}/letoltes', [ClientPortalController::class, 'download'])
        ->whereNumber('version')->name('fajl.letoltes');

    Route::get('/fajl/{version}/megtekintes', [ClientPortalController::class, 'preview'])
        ->whereNumber('version')->name('fajl.megtekintes');

    // Helyszíni fotó a haladás-naplóból
    Route::get('/foto/{photo}', [ClientPortalController::class, 'photo'])
        ->whereNumber('photo')->name('foto');

    // Árajánlat: PDF megnyitása és online visszajelzés
    Route::get('/ajanlat/{quote}/pdf', [ClientPortalController::class, 'quotePdf'])
        ->whereNumber('quote')->name('ajanlat.pdf');

    Route::post('/ajanlat/{quote}/valasz', [ClientPortalController::class, 'respondToQuote'])
        ->whereNumber('quote')->name('ajanlat.valasz');
});
