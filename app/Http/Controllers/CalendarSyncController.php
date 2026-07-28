<?php

namespace App\Http\Controllers;

use App\Models\CalendarCredential;
use App\Services\AppleCalendarProfile;
use App\Support\CalendarCollections;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response as ResponseFactory;
use Symfony\Component\HttpFoundation\Response;

/**
 * Naptár-szinkron a Profil oldalon: eszközönkénti naptár-jelszavak kezelése.
 *
 * A kulcs kizárólag a CalDAV-végponton érvényes, kibocsátani csak belépve
 * lehet (tehát jelszó + MFA után), és bármikor visszavonható.
 */
class CalendarSyncController extends Controller
{
    /**
     * A Profil oldal naptár-szekciójának adatai.
     *
     * @return array<string, mixed>
     */
    public static function props(Request $request): array
    {
        $user = $request->user();

        return [
            'enabled' => $user->can('scheduling.view'),
            'serverUrl' => rtrim((string) config('app.url'), '/').'/caldav/',
            'username' => $user->email,
            'calendars' => collect(CalendarCollections::ALL)
                ->map(fn (array $meta, string $key) => [
                    'key' => $key,
                    'name' => $meta['name'],
                    'description' => $meta['description'],
                    'writable' => $meta['writable'],
                ])
                ->values()
                ->all(),
            'devices' => $user->calendarCredentials()
                ->get()
                ->map(fn (CalendarCredential $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'created_at' => $c->created_at?->toIso8601String(),
                    'last_used_at' => $c->last_used_at?->toIso8601String(),
                    'last_ip' => $c->last_ip,
                    'revoked' => ! $c->isActive(),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * Új naptár-jelszó. A nyílt kulcsot egyszer, villanó üzenetben adjuk
     * vissza — utána már nem visszanyerhető.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user->can('scheduling.view'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [], ['name' => 'eszköz neve']);

        [, $token] = CalendarCredential::issue($user, $data['name']);

        return back()
            ->with('success', 'A naptár-jelszó elkészült.')
            ->with('calendar_token', $token)
            ->with('calendar_token_device', $data['name']);
    }

    /**
     * Apple konfigurációs profil letöltése.
     *
     * Minden letöltéshez FRISS kulcsot adunk ki: a fájl nyílt szöveggel
     * tartalmazza, ezért nem szabad újra felhasználni egy korábbit.
     */
    public function mobileconfig(Request $request, AppleCalendarProfile $profiles): Response
    {
        $user = $request->user();
        abort_unless($user->can('scheduling.view'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [], ['name' => 'eszköz neve']);

        [, $token] = CalendarCredential::issue($user, $data['name']);

        return ResponseFactory::make($profiles->build($user, $data['name'], $token), 200, [
            'Content-Type' => 'application/x-apple-aspen-config; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$profiles->fileName($data['name']).'"',
            // A fájl hitelesítő adatot tartalmaz — sem böngésző, sem proxy
            // ne tárolja el.
            'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
            'Pragma' => 'no-cache',
        ]);
    }

    public function destroy(Request $request, CalendarCredential $credential): RedirectResponse
    {
        abort_unless($credential->user_id === $request->user()->id, 403);

        $credential->revoke();

        return back()->with('success', 'A naptár-jelszó visszavonva, az eszköz többé nem szinkronizál.');
    }
}
