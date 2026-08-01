<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A külső (ügyfél-) fiókok nem léphetnek be a belső alkalmazásba.
 *
 * A modul-útvonalakat amúgy is jogosultság védi, és a „Megrendelő" szerepnek
 * nincs egy jogosultsága sem — ez a réteg viszont nem a hibaüzenetig, hanem
 * eleve a portálra tereli őket, és a jövőben felvett, jogosultság nélküli
 * útvonalakra is véd.
 */
class RedirectExternalUsers
{
    /**
     * Amit a külső fiók is elérhet: a portál, a saját fiókja (Fortify jelszó-
     * és 2FA-végpontok), valamint a ki-/beléptetés.
     *
     * @var array<int, string>
     */
    private const ALLOWED = [
        'ugyfel',
        'ugyfel/*',
        'user/*',
        'login',
        'logout',
        'two-factor-challenge',
        'forgot-password',
        'reset-password',
        'reset-password/*',
        'up',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->is_external || $request->is(...self::ALLOWED)) {
            return $next($request);
        }

        if ($request->isMethod('GET') && ! $request->expectsJson()) {
            return redirect()->route('ugyfel.index');
        }

        abort(403, 'Ez a művelet az ügyfélportálról nem érhető el.');
    }
}
