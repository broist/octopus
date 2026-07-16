<?php

use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Feladatok / To-do (13. modul, előrehozva a fő menübe)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/tasks', [TaskController::class, 'index'])
        ->middleware('can:tasks.view')->name('tasks.index');

    Route::post('/tasks', [TaskController::class, 'store'])
        ->middleware('can:tasks.create')->name('tasks.store');

    Route::put('/tasks/{task}', [TaskController::class, 'update'])
        ->middleware('can:tasks.edit')->name('tasks.update');

    // Gyors státuszváltás: a saját (kiosztott) feladatát az is átteheti,
    // akinek nincs tasks.edit joga — a controller ellenőrzi.
    Route::put('/tasks/{task}/status', [TaskController::class, 'updateStatus'])
        ->middleware('can:tasks.view')->name('tasks.status');

    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])
        ->middleware('can:tasks.delete')->name('tasks.destroy');
});
