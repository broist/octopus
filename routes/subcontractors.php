<?php

use App\Http\Controllers\SubcontractorController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Alvállalkozók (5. modul)
|--------------------------------------------------------------------------
|
| Kiemelt, önálló modul a közös partner-adatbázison (is_subcontractor).
| Törzsadatok + szakma, tanúsítványok lejárati figyelmeztetéssel, értékelés,
| dokumentumok, projekt-hozzárendelés. Minden útvonal a subcontractors.*
| jogosultsághoz kötött.
|
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/subcontractors', [SubcontractorController::class, 'index'])
        ->middleware('can:subcontractors.view')->name('subcontractors.index');

    Route::post('/subcontractors', [SubcontractorController::class, 'store'])
        ->middleware('can:subcontractors.create')->name('subcontractors.store');

    Route::get('/subcontractors/{partner}', [SubcontractorController::class, 'show'])
        ->middleware('can:subcontractors.view')->name('subcontractors.show');

    Route::put('/subcontractors/{partner}', [SubcontractorController::class, 'update'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.update');

    Route::delete('/subcontractors/{partner}', [SubcontractorController::class, 'destroy'])
        ->middleware('can:subcontractors.delete')->name('subcontractors.destroy');

    // --- Tanúsítványok / engedélyek ---
    Route::post('/subcontractors/{partner}/certifications', [SubcontractorController::class, 'storeCertification'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.certifications.store');

    Route::get('/subcontractor-certifications/{certification}/download', [SubcontractorController::class, 'downloadCertification'])
        ->middleware('can:subcontractors.view')->name('subcontractors.certifications.download');

    Route::delete('/subcontractor-certifications/{certification}', [SubcontractorController::class, 'destroyCertification'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.certifications.destroy');

    // --- Értékelések ---
    Route::post('/subcontractors/{partner}/ratings', [SubcontractorController::class, 'storeRating'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.ratings.store');

    Route::delete('/subcontractor-ratings/{rating}', [SubcontractorController::class, 'destroyRating'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.ratings.destroy');

    // --- Dokumentumok ---
    Route::post('/subcontractors/{partner}/documents', [SubcontractorController::class, 'storeDocument'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.documents.store');

    Route::get('/subcontractor-documents/{document}/download', [SubcontractorController::class, 'downloadDocument'])
        ->middleware('can:subcontractors.view')->name('subcontractors.documents.download');

    Route::delete('/subcontractor-documents/{document}', [SubcontractorController::class, 'destroyDocument'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.documents.destroy');

    // --- Projekt-hozzárendelés ---
    Route::post('/subcontractors/{partner}/projects', [SubcontractorController::class, 'attachProject'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.projects.attach');

    Route::delete('/subcontractors/{partner}/projects/{project}', [SubcontractorController::class, 'detachProject'])
        ->middleware('can:subcontractors.edit')->name('subcontractors.projects.detach');
});
