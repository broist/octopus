<?php

use App\Http\Controllers\MaterialController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Anyagok / Készlet (8. modul)
|--------------------------------------------------------------------------
|
| Projektre kötött beszerzés-követés (nem valós idejű raktár): anyagtörzs
| (katalógus) + projekthez kötött beszerzések (mennyiség, ár, beszállító,
| státusz tervezett/megrendelve/beérkezett). Minden útvonal a materials.*
| jogosultsághoz kötött.
|
*/

Route::middleware(['auth'])->group(function () {
    // --- Beszerzések (fő nézet) ---
    Route::get('/materials', [MaterialController::class, 'index'])
        ->middleware('can:materials.view')->name('materials.index');

    Route::post('/material-procurements', [MaterialController::class, 'store'])
        ->middleware('can:materials.create')->name('materials.store');

    Route::put('/material-procurements/{procurement}', [MaterialController::class, 'update'])
        ->middleware('can:materials.edit')->name('materials.update');

    Route::delete('/material-procurements/{procurement}', [MaterialController::class, 'destroy'])
        ->middleware('can:materials.delete')->name('materials.destroy');

    Route::post('/material-procurements/{procurement}/receive', [MaterialController::class, 'receive'])
        ->middleware('can:materials.edit')->name('materials.receive');

    // --- Anyagtörzs (katalógus) ---
    Route::get('/materials/catalog', [MaterialController::class, 'catalog'])
        ->middleware('can:materials.view')->name('materials.catalog');

    Route::post('/material-catalog', [MaterialController::class, 'storeMaterial'])
        ->middleware('can:materials.create')->name('materials.catalog.store');

    Route::put('/material-catalog/{material}', [MaterialController::class, 'updateMaterial'])
        ->middleware('can:materials.edit')->name('materials.catalog.update');

    Route::delete('/material-catalog/{material}', [MaterialController::class, 'destroyMaterial'])
        ->middleware('can:materials.delete')->name('materials.catalog.destroy');
});
