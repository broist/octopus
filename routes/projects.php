<?php

use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectPhaseController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Projektek / Munkák (2. modul)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/projects', [ProjectController::class, 'index'])
        ->middleware('can:projects.view')->name('projects.index');

    Route::get('/projects/create', [ProjectController::class, 'create'])
        ->middleware('can:projects.create')->name('projects.create');

    Route::post('/projects', [ProjectController::class, 'store'])
        ->middleware('can:projects.create')->name('projects.store');

    // Gyors megrendelő-felvétel az űrlapról (teljes partnerkezelés: CRM modul).
    Route::post('/projects/clients', [ProjectController::class, 'quickClient'])
        ->middleware('permission:projects.create|projects.edit')
        ->name('projects.clients.quick');

    Route::get('/projects/{project}', [ProjectController::class, 'show'])
        ->middleware('can:projects.view')->name('projects.show');

    Route::get('/projects/{project}/edit', [ProjectController::class, 'edit'])
        ->middleware('can:projects.edit')->name('projects.edit');

    Route::put('/projects/{project}', [ProjectController::class, 'update'])
        ->middleware('can:projects.edit')->name('projects.update');

    Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])
        ->middleware('can:projects.delete')->name('projects.destroy');

    // Fázisok
    Route::post('/projects/{project}/phases', [ProjectPhaseController::class, 'store'])
        ->middleware('can:projects.edit')->name('projects.phases.store');

    Route::put('/project-phases/{phase}', [ProjectPhaseController::class, 'update'])
        ->middleware('can:projects.edit')->name('projects.phases.update');

    Route::delete('/project-phases/{phase}', [ProjectPhaseController::class, 'destroy'])
        ->middleware('can:projects.edit')->name('projects.phases.destroy');

    Route::post('/project-phases/{phase}/move', [ProjectPhaseController::class, 'move'])
        ->middleware('can:projects.edit')->name('projects.phases.move');

    Route::post('/project-phases/{phase}/compute', [ProjectPhaseController::class, 'compute'])
        ->middleware('can:projects.edit')->name('projects.phases.compute');
});
