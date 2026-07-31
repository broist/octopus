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

    // Idővonal: hozzászólni a feladatot látó bármelyik felhasználó tud, a
    // törlést a controller korlátozza a saját bejegyzésre (vagy tasks.delete).
    Route::get('/tasks/{task}/timeline', [TaskController::class, 'timeline'])
        ->middleware('can:tasks.view')->name('tasks.timeline');

    Route::post('/tasks/{task}/comments', [TaskController::class, 'storeComment'])
        ->middleware('can:tasks.view')->name('tasks.comments.store');

    Route::delete('/task-comments/{comment}', [TaskController::class, 'destroyComment'])
        ->middleware('can:tasks.view')->name('tasks.comments.destroy');

    // Feladat-csatolmány letöltése.
    Route::get('/task-attachments/{attachment}', [TaskController::class, 'downloadAttachment'])
        ->middleware('can:tasks.view')->name('tasks.attachments.download');
});
