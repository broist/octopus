<?php

use App\Http\Controllers\FinanceController;
use App\Http\Controllers\MemberLedgerController;
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

    /*
    |--------------------------------------------------------------------
    | Tagi kölcsön és közös költségek
    |--------------------------------------------------------------------
    |
    | FONTOS: ezek a rögzített utak a /finance/{project} ELŐTT állnak,
    | különben a „tagi-kolcson” szegmenst a route-model-binding próbálná
    | projektként feloldani.
    |
    | A nyilvántartás tulajdonosi adat: a `finance.ledger` képességet az IT
    | Admin (Gate::before) és a cégtagként rögzített felhasználók kapják meg
    | (lásd AppServiceProvider) — a finance.view önmagában nem elég.
    */
    Route::middleware('can:finance.ledger')->group(function () {
        Route::get('/finance/tagi-kolcson', [MemberLedgerController::class, 'index'])
            ->name('finance.ledger');
        Route::get('/finance/tagi-kolcson/beallitasok', [MemberLedgerController::class, 'settings'])
            ->name('finance.ledger.settings');

        // Módosítók külön útvonalon (a /finance/{project} ütközés elkerülésére).
        Route::post('/ledger-costs', [MemberLedgerController::class, 'storeCost'])
            ->middleware('can:finance.create')->name('finance.ledger.costs.store');
        Route::put('/ledger-costs/{cost}', [MemberLedgerController::class, 'updateCost'])
            ->middleware('can:finance.edit')->name('finance.ledger.costs.update');
        Route::delete('/ledger-costs/{cost}', [MemberLedgerController::class, 'destroyCost'])
            ->middleware('can:finance.delete')->name('finance.ledger.costs.destroy');

        Route::post('/ledger-payments', [MemberLedgerController::class, 'storePayment'])
            ->middleware('can:finance.create')->name('finance.ledger.payments.store');
        Route::post('/ledger-shares/{share}/settle', [MemberLedgerController::class, 'settleShare'])
            ->middleware('can:finance.create')->name('finance.ledger.shares.settle');
        Route::delete('/ledger-payments/{payment}', [MemberLedgerController::class, 'destroyPayment'])
            ->middleware('can:finance.delete')->name('finance.ledger.payments.destroy');

        Route::post('/ledger-members', [MemberLedgerController::class, 'storeMember'])
            ->middleware('can:finance.edit')->name('finance.ledger.members.store');
        Route::post('/ledger-members/seed', [MemberLedgerController::class, 'seedMembers'])
            ->middleware('can:finance.edit')->name('finance.ledger.members.seed');
        Route::put('/ledger-members/{member}', [MemberLedgerController::class, 'updateMember'])
            ->middleware('can:finance.edit')->name('finance.ledger.members.update');
        Route::delete('/ledger-members/{member}', [MemberLedgerController::class, 'destroyMember'])
            ->middleware('can:finance.delete')->name('finance.ledger.members.destroy');

        Route::post('/ledger-recurring', [MemberLedgerController::class, 'storeRecurring'])
            ->middleware('can:finance.create')->name('finance.ledger.recurring.store');
        Route::put('/ledger-recurring/{recurring}', [MemberLedgerController::class, 'updateRecurring'])
            ->middleware('can:finance.edit')->name('finance.ledger.recurring.update');
        Route::delete('/ledger-recurring/{recurring}', [MemberLedgerController::class, 'destroyRecurring'])
            ->middleware('can:finance.delete')->name('finance.ledger.recurring.destroy');

        Route::put('/ledger-settings', [MemberLedgerController::class, 'updateSettings'])
            ->middleware('can:finance.edit')->name('finance.ledger.settings.update');
        Route::post('/ledger-scan', [MemberLedgerController::class, 'rescan'])
            ->middleware('can:finance.create')->name('finance.ledger.scan');
    });

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
