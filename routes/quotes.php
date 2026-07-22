<?php

use App\Http\Controllers\QuoteController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Ajánlatkérő (árajánlat-készítő) modul
|--------------------------------------------------------------------------
|
| A portolt AcuWall árajánlat-app. A jogosultság a ajanlatok.* kulcsokhoz
| kötött. A /tab/{tab} útvonal a sidebar almenüiből a legutóbbi ajánlat
| megfelelő fülére irányít.
|
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/ajanlatok', [QuoteController::class, 'index'])
        ->middleware('can:ajanlatok.view')->name('ajanlatok.index');

    Route::post('/ajanlatok', [QuoteController::class, 'store'])
        ->middleware('can:ajanlatok.create')->name('ajanlatok.store');

    Route::get('/ajanlatok/tab/{tab}', [QuoteController::class, 'tab'])
        ->middleware('can:ajanlatok.view')->name('ajanlatok.tab');

    Route::get('/ajanlatok/{quote}', [QuoteController::class, 'show'])
        ->whereNumber('quote')->middleware('can:ajanlatok.view')->name('ajanlatok.show');

    Route::put('/ajanlatok/{quote}', [QuoteController::class, 'update'])
        ->whereNumber('quote')->middleware('can:ajanlatok.edit')->name('ajanlatok.update');

    Route::delete('/ajanlatok/{quote}', [QuoteController::class, 'destroy'])
        ->whereNumber('quote')->middleware('can:ajanlatok.delete')->name('ajanlatok.destroy');

    Route::post('/ajanlatok/{quote}/approve', [QuoteController::class, 'approve'])
        ->whereNumber('quote')->middleware('can:ajanlatok.edit')->name('ajanlatok.approve');

    Route::post('/ajanlatok/{quote}/pdf', [QuoteController::class, 'savePdf'])
        ->whereNumber('quote')->middleware('can:ajanlatok.view')->name('ajanlatok.pdf');

    Route::get('/ajanlatok/{quote}/pdf', [QuoteController::class, 'downloadPdf'])
        ->whereNumber('quote')->middleware('can:ajanlatok.view')->name('ajanlatok.pdf.download');
});
