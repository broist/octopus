<?php

use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Riportok / Statisztikák (15. modul)
|--------------------------------------------------------------------------
|
| A többi modul adataiból készülő elemző kimutatások: nyereségesség, csúszás,
| költség terv-tény, erőforrás-kihasználtság, alvállalkozói statisztika,
| kifizetések, minőség és időszaki összesítők — CSV/PDF exporttal.
| Minden útvonal a reports.view jogosultsághoz kötött (csak olvasás).
|
*/

Route::middleware(['auth', 'can:reports.view'])->group(function () {
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');

    // Az export előbb, hogy a riport-kulcs ne nyelje el az /export végződést.
    Route::get('/reports/{report}/export', [ReportController::class, 'export'])->name('reports.export');

    Route::get('/reports/{report}', [ReportController::class, 'index'])->name('reports.show');
});
