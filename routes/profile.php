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
        // A nyílt naptár-jelszó csak közvetlenül a létrehozás után, egyszer
        // jelenik meg — utána már csak a lenyomata létezik.
        'calendarToken' => session('calendar_token'),
        'calendarTokenDevice' => session('calendar_token_device'),
        'calendarProfileUrl' => session('calendar_profile_url'),
    ]))->name('profile.edit');

    Route::post('/profile/calendar-sync', [CalendarSyncController::class, 'store'])
        ->name('profile.calendar-sync.store');

    Route::post('/profile/calendar-sync/mobileconfig', [CalendarSyncController::class, 'mobileconfig'])
        ->name('profile.calendar-sync.mobileconfig');

    // A letöltés szándékosan GET: az iOS beépített böngészője a fájlt
    // visszaadó választ újraküldi GET-tel, a POST-os letöltés ezért hasalt el.
    Route::get('/profile/calendar-sync/mobileconfig/{key}', [CalendarSyncController::class, 'profile'])
        ->where('key', '[A-Za-z0-9]{40}')
        ->name('profile.calendar-sync.profile');

    Route::delete('/profile/calendar-sync/{credential}', [CalendarSyncController::class, 'destroy'])
        ->name('profile.calendar-sync.destroy');
});
