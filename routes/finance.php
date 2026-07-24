<?php

use App\Http\Controllers\FinanceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Pénzügy / Költségvetés (9. modul)
|--------------------------------------------------------------------------
|
| Projektenkénti terv-vs-tény és nyereségesség: szerződéses érték / ajánlat
| (bevétel), tervezett költségvetés, tényleges költség (anyag automatikusan az
| Anyagok modulból + alvállalkozó/gép/egyéb tételek, opc. bejövő számla).
| Minden útvonal a finance.* jogosultsághoz kötött.
|
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/finance', [FinanceController::class, 'index'])
        ->middleware('can:finance.view')->name('finance.index');

    Route::get('/finance/{project}', [FinanceController::class, 'show'])
        ->middleware('can:finance.view')->name('finance.show');

    Route::put('/finance/{project}/contract', [FinanceController::class, 'updateContract'])
        ->middleware('can:finance.edit')->name('finance.contract.update');

    // --- Költségvetési tételek (terv) ---
    Route::post('/finance/{project}/budget-items', [FinanceController::class, 'storeBudgetItem'])
        ->middleware('can:finance.edit')->name('finance.budget.store');

    Route::delete('/budget-items/{item}', [FinanceController::class, 'destroyBudgetItem'])
        ->middleware('can:finance.edit')->name('finance.budget.destroy');

    // --- Tényleges költségek / bejövő számlák ---
    Route::post('/finance/{project}/costs', [FinanceController::class, 'storeCost'])
        ->middleware('can:finance.edit')->name('finance.costs.store');

    Route::put('/project-costs/{cost}', [FinanceController::class, 'updateCost'])
        ->middleware('can:finance.edit')->name('finance.costs.update');

    Route::post('/project-costs/{cost}/toggle-paid', [FinanceController::class, 'togglePaid'])
        ->middleware('can:finance.edit')->name('finance.costs.toggle-paid');

    Route::get('/project-costs/{cost}/download', [FinanceController::class, 'downloadCost'])
        ->middleware('can:finance.view')->name('finance.costs.download');

    Route::delete('/project-costs/{cost}', [FinanceController::class, 'destroyCost'])
        ->middleware('can:finance.delete')->name('finance.costs.destroy');
});
