<?php

use App\Http\Controllers\LeadWebhookController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Értesítések (harang a fejlécben) + lead webhook
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {
    // Minden értesítés olvasottnak jelölése (a harang menü gombja).
    Route::post('/notifications/read', function (Request $request) {
        $request->user()->unreadNotifications->markAsRead();

        return back();
    })->name('notifications.read');
});

// Weboldal → Octopus közvetlen lead-becsatorna (tokennel védve; e-mail
// helyett/mellett). Vendég végpont, a token a hitelesítés.
Route::post('/webhooks/lead', [LeadWebhookController::class, 'store'])
    ->name('webhooks.lead');
