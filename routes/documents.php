<?php

use App\Http\Controllers\DocumentController;
use App\Http\Controllers\DocumentVersionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Fájlkezelő / Dokumentumtár (10. modul, előrehozva a fő menübe)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/documents', [DocumentController::class, 'index'])
        ->middleware('can:documents.view')->name('documents.index');

    Route::post('/documents', [DocumentController::class, 'store'])
        ->middleware('can:documents.create')->name('documents.store');

    Route::get('/documents/{document}', [DocumentController::class, 'show'])
        ->middleware('can:documents.view')->name('documents.show');

    Route::put('/documents/{document}', [DocumentController::class, 'update'])
        ->middleware('can:documents.edit')->name('documents.update');

    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])
        ->middleware('can:documents.delete')->name('documents.destroy');

    // Verziók
    Route::post('/documents/{document}/versions', [DocumentVersionController::class, 'store'])
        ->middleware('permission:documents.create|documents.edit')
        ->name('documents.versions.store');

    Route::post('/document-versions/{version}/make-current', [DocumentVersionController::class, 'makeCurrent'])
        ->middleware('can:documents.edit')->name('documents.versions.make-current');

    Route::get('/document-versions/{version}/download', [DocumentVersionController::class, 'download'])
        ->middleware('can:documents.view')->name('documents.versions.download');

    Route::get('/document-versions/{version}/preview', [DocumentVersionController::class, 'preview'])
        ->middleware('can:documents.view')->name('documents.versions.preview');
});
