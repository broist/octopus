<?php

use App\Http\Controllers\DocumentController;
use App\Http\Controllers\DocumentVersionController;
use App\Http\Controllers\FolderController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Fájlkezelő / Dokumentumtár (10. modul, előrehozva a fő menübe)
|--------------------------------------------------------------------------
| A route-szintű middleware a modul-belépést őrzi (documents.view); a
| mappa-szintű ACL finomhangolást a controllerek végzik (Folder::can*).
*/

Route::middleware(['auth', 'can:documents.view'])->group(function () {
    Route::get('/documents', [DocumentController::class, 'index'])
        ->name('documents.index');

    Route::post('/documents', [DocumentController::class, 'store'])
        ->name('documents.store');

    // Mappák
    Route::post('/folders', [FolderController::class, 'store'])->name('folders.store');
    Route::put('/folders/{folder}', [FolderController::class, 'update'])->name('folders.update');
    Route::put('/folders/{folder}/move', [FolderController::class, 'move'])->name('folders.move');
    Route::put('/folders/{folder}/permissions', [FolderController::class, 'permissions'])->name('folders.permissions');
    Route::delete('/folders/{folder}', [FolderController::class, 'destroy'])->name('folders.destroy');

    // Fájl áthelyezése
    Route::put('/documents/{document}/move', [DocumentController::class, 'move'])->name('documents.move');

    Route::get('/documents/{document}', [DocumentController::class, 'show'])
        ->name('documents.show');

    Route::put('/documents/{document}', [DocumentController::class, 'update'])
        ->name('documents.update');

    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])
        ->name('documents.destroy');

    // Verziók
    Route::post('/documents/{document}/versions', [DocumentVersionController::class, 'store'])
        ->name('documents.versions.store');

    Route::post('/document-versions/{version}/make-current', [DocumentVersionController::class, 'makeCurrent'])
        ->name('documents.versions.make-current');

    Route::get('/document-versions/{version}/download', [DocumentVersionController::class, 'download'])
        ->name('documents.versions.download');

    Route::get('/document-versions/{version}/preview', [DocumentVersionController::class, 'preview'])
        ->name('documents.versions.preview');
});
