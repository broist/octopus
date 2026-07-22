<?php

use App\Http\Controllers\StaffController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Munkatársak / Erőforrások (6. modul)
|--------------------------------------------------------------------------
|
| Saját dolgozók HR-nézete a közös users táblán (belső felhasználók).
| Végzettségek lejárati figyelmeztetéssel, manuális munkaidő-nyilvántartás,
| szabadság/távollét. A fiók/szerepkör a 16. modulban kezelt.
|
| Jogosultság: a modul megtekintése staff.view-hoz kötött. A SZERKESZTÉS
| tulajdon-alapú — mindenki KIZÁRÓLAG a saját adatlapját módosíthatja (az
| admint is beleértve, megrendelői döntés); ezt a controller assertSelf()-e
| érvényesíti, ezért a módosító útvonalak is csak staff.view-t kérnek.
|
*/

Route::middleware(['auth'])->group(function () {
    Route::get('/staff', [StaffController::class, 'index'])
        ->middleware('can:staff.view')->name('staff.index');

    Route::get('/staff/{user}', [StaffController::class, 'show'])
        ->middleware('can:staff.view')->name('staff.show');

    Route::put('/staff/{user}/hr', [StaffController::class, 'updateHr'])
        ->middleware('can:staff.view')->name('staff.hr.update');

    // --- Végzettségek / jogosultságok (csak a saját) ---
    Route::post('/staff/{user}/qualifications', [StaffController::class, 'storeQualification'])
        ->middleware('can:staff.view')->name('staff.qualifications.store');

    Route::get('/staff-qualifications/{qualification}/download', [StaffController::class, 'downloadQualification'])
        ->middleware('can:staff.view')->name('staff.qualifications.download');

    Route::delete('/staff-qualifications/{qualification}', [StaffController::class, 'destroyQualification'])
        ->middleware('can:staff.view')->name('staff.qualifications.destroy');

    // --- Munkaidő-nyilvántartás (csak a saját) ---
    Route::post('/staff/{user}/work-logs', [StaffController::class, 'storeWorkLog'])
        ->middleware('can:staff.view')->name('staff.work-logs.store');

    Route::delete('/work-logs/{workLog}', [StaffController::class, 'destroyWorkLog'])
        ->middleware('can:staff.view')->name('staff.work-logs.destroy');

    // --- Szabadság / távollét (csak a saját) ---
    Route::post('/staff/{user}/absences', [StaffController::class, 'storeAbsence'])
        ->middleware('can:staff.view')->name('staff.absences.store');

    Route::delete('/staff-absences/{absence}', [StaffController::class, 'destroyAbsence'])
        ->middleware('can:staff.view')->name('staff.absences.destroy');
});
