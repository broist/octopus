<?php

use App\Support\Modules;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Module placeholder routes
|--------------------------------------------------------------------------
|
| Every module that is not yet implemented gets an automatic placeholder page
| so the full sidebar is navigable from day one. As each module is built, its
| key is added to Modules::implemented() and it gains its own routes file.
|
*/

$implemented = Modules::implemented();

Route::middleware(['auth'])->group(function () use ($implemented) {
    foreach (Modules::all() as $module) {
        if (in_array($module['key'], $implemented, true)) {
            continue;
        }

        Route::get('/'.$module['key'], fn () => Inertia::render('Modules/Placeholder', [
            'module' => [
                'key' => $module['key'],
                'label' => $module['label'],
                'icon' => $module['icon'],
            ],
        ]))
            ->middleware('can:'.$module['key'].'.view')
            ->name($module['route']);
    }
});
