<?php

use App\Http\Controllers\CaldavController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| CalDAV (3. modul — naptár-szinkron)
|--------------------------------------------------------------------------
| Ezek az útvonalak szándékosan a `web` middleware-csoporton KÍVÜL futnak:
| a CalDAV-kliens nem tud munkamenet-sütit és CSRF-tokent kezelni, a
| hitelesítés naptár-jelszóval, basic authtal történik. A jogosultságokat a
| CalDAV-backend ellenőrzi, ugyanazokkal a szabályokkal, mint a felület.
*/

// A WebDAV nem szabványos metódusokat használ, ezért nem elég a Route::any().
$methods = [
    'OPTIONS', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE',
    'PROPFIND', 'PROPPATCH', 'REPORT', 'MKCALENDAR', 'MKCOL',
    'MOVE', 'COPY', 'LOCK', 'UNLOCK', 'ACL',
];

Route::match($methods, '/caldav/{path?}', CaldavController::class)
    ->where('path', '.*')
    ->name('caldav');

// Az iOS és a macOS innen indítja a fiók felfedezését.
Route::match(['GET', 'PROPFIND', 'OPTIONS'], '/.well-known/caldav', [CaldavController::class, 'wellKnown'])
    ->name('caldav.well-known');
