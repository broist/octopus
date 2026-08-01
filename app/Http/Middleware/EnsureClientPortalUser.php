<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Az ügyfélportál kapuja.
 *
 * Beenged, ha a belépett fiók külső (is_external). Belső munkatársat
 * visszairányítunk a vezérlőpultra: nekik a teljes app szól.
 *
 * A partner-kötés hiánya NEM itt bukik el: a nyitóoldal magyarázó képernyőt
 * mutat (ahonnan ki is lehet lépni), a tartalmat adó végpontokat pedig a
 * controller `partner()` segédje őrzi. Így egy félkész fiók sem ragad be egy
 * csupasz hibaoldalra.
 */
class EnsureClientPortalUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->guest(route('login'));
        }

        if (! $user->is_external) {
            return redirect()->route('dashboard');
        }

        // A nyitóoldal partner nélkül is megnyílik (magyarázó képernyő).
        if ($user->partner_id === null && ! $request->routeIs('ugyfel.index', 'ugyfel.fiok')) {
            return redirect()->route('ugyfel.index');
        }

        return $next($request);
    }
}
