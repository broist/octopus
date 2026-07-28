<?php

use App\Http\Controllers\CalendarSyncController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
| Account settings: profile information, password, two-factor auth and the
| calendar sync (CalDAV) device passwords. The mutating endpoints for the
| first three are provided by Laravel Fortify.
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/profile', fn (Request $request) => Inertia::render('Profile/Edit', [
        'status' => session('status'),
        'calendarSync' => CalendarSyncController::props($request),
    ]))->name('profile.edit');

    Route::post('/profile/calendar-sync', [CalendarSyncController::class, 'store'])
        ->name('profile.calendar-sync.store');

    Route::post('/profile/calendar-sync/mobileconfig', [CalendarSyncController::class, 'mobileconfig'])
        ->name('profile.calendar-sync.mobileconfig');

    Route::delete('/profile/calendar-sync/{credential}', [CalendarSyncController::class, 'destroy'])
        ->name('profile.calendar-sync.destroy');
});

/*
| A konfigurációs profil letöltése szándékosan `auth` NÉLKÜL, GET-tel:
|
| - GET, mert az iOS a fájlt visszaadó POST-választ újraküldi GET-tel
| - belépés nélkül, mert a telefon a profilfájl letöltését átadja a
|   rendszernek, ami már nem viszi magával a munkamenet-sütit — így a
|   letöltés belépést kérne, és a profil sosem települne
|
| A jogosultságot maga az URL-ben lévő kulcs hordozza (mint egy jelszó-
| visszaállító linknél): 40 véletlen karakter, egyszer használható, és
| negyed óra után lejár. Csak belépve, saját magának tudja bárki kérni.
*/
Route::get('/profile/calendar-sync/mobileconfig/{key}', [CalendarSyncController::class, 'profile'])
    ->where('key', '[A-Za-z0-9]{40}')
    ->name('profile.calendar-sync.profile');
