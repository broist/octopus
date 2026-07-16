<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Module routes are registered in dedicated files under routes/ and required
| here as each module is built. The public landing page lives below.
|
*/

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    return Inertia::render('Welcome', [
        'appName' => config('app.name'),
    ]);
})->name('home');

require __DIR__.'/dashboard.php';
require __DIR__.'/profile.php';
require __DIR__.'/projects.php';
require __DIR__.'/documents.php';
require __DIR__.'/tasks.php';

// Placeholder routes for not-yet-implemented modules (keeps the sidebar whole).
require __DIR__.'/modules.php';
