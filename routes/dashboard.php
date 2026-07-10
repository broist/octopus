<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
| Authenticated area. The full dashboard aggregation is built in Module 1;
| this route gives Fortify a valid post-login landing target.
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', function () {
        return Inertia::render('Dashboard/Index');
    })->name('dashboard');
});
