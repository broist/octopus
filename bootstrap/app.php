<?php

use App\Http\Middleware\EnsureClientPortalUser;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RedirectExternalUsers;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // A CalDAV-végpont middleware-csoport nélkül fut: a telefon
            // naptár-kliense nem kezel munkamenetet és CSRF-tokent, a
            // hitelesítés naptár-jelszóval (basic auth) történik.
            Route::group([], __DIR__.'/../routes/caldav.php');

            // Ugyanez az Office WebDAV-végpontjára: ott az URL-ben lévő jegy
            // hitelesít (az Office sem küld munkamenet-sütit).
            Route::group([], __DIR__.'/../routes/webdav.php');
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            // A külső (ügyfél-) fiókokat a portálon tartja.
            RedirectExternalUsers::class,
        ]);

        // A lead webhookot külső rendszer (a weboldal űrlapja) hívja —
        // tokennel hitelesít, CSRF token értelemszerűen nincs.
        $middleware->validateCsrfTokens(except: [
            'webhooks/lead',
        ]);

        $middleware->alias([
            'portal' => EnsureClientPortalUser::class,
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
