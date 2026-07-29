<?php

use App\Http\Controllers\OfficeWebdavController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| WebDAV — asztali Office-ban való szerkesztés (10. modul)
|--------------------------------------------------------------------------
| Ezek az útvonalak szándékosan a `web` middleware-csoporton KÍVÜL futnak: az
| Office WebDAV-rétege nem küld munkamenet-sütit és CSRF-tokent. A hozzáférést
| az URL-ben lévő rövid életű jegy adja, a mentés jogát pedig a mappa-jogosultság
| dönti el minden mentésnél.
*/

// A WebDAV nem szabványos metódusokat használ, ezért nem elég a Route::any().
$methods = [
    'OPTIONS', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE',
    'PROPFIND', 'PROPPATCH', 'MKCOL', 'MOVE', 'COPY', 'LOCK', 'UNLOCK',
];

Route::match($methods, '/office/{token}/{path?}', OfficeWebdavController::class)
    ->where('token', '[a-f0-9]{48}')
    ->where('path', '.*')
    ->name('office.webdav');
