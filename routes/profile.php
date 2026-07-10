<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
| Account settings: profile information, password, and two-factor auth.
| The mutating endpoints are provided by Laravel Fortify; this route only
| renders the settings screen.
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/profile', fn () => Inertia::render('Profile/Edit', [
        'status' => session('status'),
    ]))->name('profile.edit');
});
