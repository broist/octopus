<?php

namespace App\Http\Controllers;

use App\Models\CalendarCredential;
use App\Services\AppleCalendarProfile;
use App\Support\CalendarCollections;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Response as ResponseFactory;
use Illuminate\Support\Str;
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
     * Meddig él a letöltő hivatkozás. Elég idő a telefonra átvinni, de a
     * naptár-jelszót tartalmazó fájl ne heverjen sokáig kiadhatóan.
     */
    private const PROFILE_TTL = 900;

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
     * Új naptár-jelszó.
     *
     * A nyílt kulcsot KÖZVETLENÜL a válaszban adjuk vissza, nem villanó
     * munkamenet-üzenetben: az átirányítás után megjelenő doboz a telefon
     * képernyőjén a görgetési pozíció fölé kerülhet, és a felhasználónak úgy
     * tűnik, a gomb nem csinál semmit. A választ a felület párbeszédablakban
     * mutatja meg, ami nem múlhat el észrevétlenül.
     *
     * A kulcs sehol máshol nem kérhető le újra — az adatbázisban csak a
     * lenyomata van.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('scheduling.view'), 403);

        $data = $this->validateDeviceName($request);

        [, $token] = CalendarCredential::issue($user, $data['name']);

        return response()->json([
            'device' => $data['name'],
            'token' => $token,
        ]);
    }

    /**
     * Apple konfigurációs profil előkészítése.
     *
     * Két lépésre bontva, mert a fájlt visszaadó választ az iOS beépített
     * böngészője ÚJRAKÜLDI GET-tel, hogy átadhassa a rendszer letöltőjének —
     * a POST-ra épülő letöltés ezért a telefonon 405-tel elhasalt. Így a
     * módosítás marad CSRF-védett POST, a letöltés pedig sima GET.
     *
     * Minden letöltéshez FRISS kulcsot adunk ki: a fájl nyílt szöveggel
     * tartalmazza, ezért nem szabad újra felhasználni egy korábbit.
     */
    public function mobileconfig(Request $request, AppleCalendarProfile $profiles): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('scheduling.view'), 403);

        $data = $this->validateDeviceName($request);

        [, $token] = CalendarCredential::issue($user, $data['name']);

        // A kész fájl a gyorsítótárban vár a letöltésre, egyszer használatos
        // kulcs alatt. Szándékosan NEM a munkamenetben: a telefon a profilfájl
        // letöltését átadja a rendszernek, az pedig már nem viszi magával a
        // munkamenet-sütit — így a letöltés belépést kérne és elhasalna.
        // A kulcs maga a jogosultság (mint egy jelszó-visszaállító link):
        // kitalálhatatlan, egyszer használható, és rövid idő után lejár.
        $key = Str::random(40);

        Cache::put("calendar-profile:{$key}", [
            'file' => $profiles->fileName($data['name']),
            'body' => $profiles->build($user, $data['name'], $token),
        ], self::PROFILE_TTL);

        return response()->json([
            'device' => $data['name'],
            'url' => route('profile.calendar-sync.profile', $key),
        ]);
    }

    /**
     * Az előkészített profil kiadása — egyszer használatos, belépés nélkül.
     */
    public function profile(string $key): Response
    {
        $payload = Cache::pull("calendar-profile:{$key}");

        abort_if($payload === null, 410, 'Ez a letöltési hivatkozás lejárt vagy már felhasználódott. Kérj újat a Profil oldalon.');

        return ResponseFactory::make($payload['body'], 200, [
            'Content-Type' => 'application/x-apple-aspen-config; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$payload['file'].'"',
            // A fájl hitelesítő adatot tartalmaz — sem böngésző, sem proxy
            // ne tárolja el.
            'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * Az eszköz neve. Az alkalmazás alapértelmezett nyelve angol, ezért a
     * hibaüzenetet itt adjuk meg magyarul — enélkül a felhasználó egy apró
     * angol sort kapna, és úgy tűnne, a gomb egyszerűen nem csinál semmit.
     *
     * @return array<string, string>
     */
    private function validateDeviceName(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [
            'name.required' => 'Adj nevet az eszköznek, hogy később felismerd a listában (pl. „Munkatelefon”).',
            'name.max' => 'Az eszköz neve legfeljebb 100 karakter lehet.',
        ]);
    }

    public function destroy(Request $request, CalendarCredential $credential): RedirectResponse
    {
        abort_unless($credential->user_id === $request->user()->id, 403);

        $credential->revoke();

        return back()->with('success', 'A naptár-jelszó visszavonva, az eszköz többé nem szinkronizál.');
    }
}
