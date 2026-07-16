<?php

use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Felhasználók / Munkatársak (16. modul)
|--------------------------------------------------------------------------
|
| Az adminisztrátor itt kezeli a munkatársakat: fiók felvétele, szerkesztése,
| szerepkör, aktiválás és törlés. Minden útvonal a users.* jogosultsághoz kötött.
|
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/users', [UserController::class, 'index'])
        ->middleware('can:users.view')->name('users.index');

    Route::post('/users', [UserController::class, 'store'])
        ->middleware('can:users.create')->name('users.store');

    Route::put('/users/{user}', [UserController::class, 'update'])
        ->middleware('can:users.edit')->name('users.update');

    Route::put('/users/{user}/active', [UserController::class, 'toggleActive'])
        ->middleware('can:users.edit')->name('users.active');

    Route::delete('/users/{user}', [UserController::class, 'destroy'])
        ->middleware('can:users.delete')->name('users.destroy');
});
