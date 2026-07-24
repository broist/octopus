<?php

use App\Http\Controllers\ChecklistTemplateController;
use App\Http\Controllers\InspectionController;
use App\Http\Controllers\QaController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Minőség / Munkavédelem (12. modul)
|--------------------------------------------------------------------------
|
| Szerkeszthető ellenőrző-sablonok, ellenőrzések (checklist-kitöltés), hibalisták
| (fotó + felelős + határidő + státusz, egy kattintással feladattá) és
| munkavédelmi napló. Minden útvonal a qa.* jogosultsághoz kötött. A módosító
| resource-ok külön path-on (route-model-binding ütközés elkerülésére).
|
*/

Route::middleware(['auth'])->group(function () {
    // --- Hibalisták (fő nézet) ---
    Route::get('/qa', [QaController::class, 'index'])
        ->middleware('can:qa.view')->name('qa.index');

    Route::post('/qa-defects', [QaController::class, 'storeDefect'])
        ->middleware('can:qa.create')->name('qa.defects.store');
    Route::put('/qa-defects/{defect}', [QaController::class, 'updateDefect'])
        ->middleware('can:qa.edit')->name('qa.defects.update');
    Route::delete('/qa-defects/{defect}', [QaController::class, 'destroyDefect'])
        ->middleware('can:qa.delete')->name('qa.defects.destroy');
    Route::post('/qa-defects/{defect}/to-task', [QaController::class, 'toTask'])
        ->middleware('can:qa.edit')->name('qa.defects.to-task');
    Route::get('/qa-defect-photos/{photo}', [QaController::class, 'defectPhoto'])
        ->middleware('can:qa.view')->name('qa.defect-photos.show');

    // --- Ellenőrző-sablonok ---
    Route::get('/qa/templates', [ChecklistTemplateController::class, 'index'])
        ->middleware('can:qa.view')->name('qa.templates.index');
    Route::post('/qa-templates', [ChecklistTemplateController::class, 'store'])
        ->middleware('can:qa.create')->name('qa.templates.store');
    Route::put('/qa-templates/{checklistTemplate}', [ChecklistTemplateController::class, 'update'])
        ->middleware('can:qa.edit')->name('qa.templates.update');
    Route::delete('/qa-templates/{checklistTemplate}', [ChecklistTemplateController::class, 'destroy'])
        ->middleware('can:qa.delete')->name('qa.templates.destroy');

    // --- Ellenőrzések (checklist-kitöltés) ---
    Route::get('/qa/inspections', [InspectionController::class, 'index'])
        ->middleware('can:qa.view')->name('qa.inspections.index');
    Route::post('/qa-inspections', [InspectionController::class, 'store'])
        ->middleware('can:qa.create')->name('qa.inspections.store');
    Route::get('/qa/inspections/{inspection}', [InspectionController::class, 'show'])
        ->middleware('can:qa.view')->name('qa.inspections.show');
    Route::put('/qa-inspections/{inspection}', [InspectionController::class, 'update'])
        ->middleware('can:qa.edit')->name('qa.inspections.update');
    Route::delete('/qa-inspections/{inspection}', [InspectionController::class, 'destroy'])
        ->middleware('can:qa.delete')->name('qa.inspections.destroy');

    // --- Munkavédelmi nyilvántartás ---
    Route::get('/qa/safety', [QaController::class, 'safety'])
        ->middleware('can:qa.view')->name('qa.safety.index');
    Route::post('/qa-safety', [QaController::class, 'storeSafety'])
        ->middleware('can:qa.create')->name('qa.safety.store');
    Route::put('/qa-safety/{safetyRecord}', [QaController::class, 'updateSafety'])
        ->middleware('can:qa.edit')->name('qa.safety.update');
    Route::delete('/qa-safety/{safetyRecord}', [QaController::class, 'destroySafety'])
        ->middleware('can:qa.delete')->name('qa.safety.destroy');
});
