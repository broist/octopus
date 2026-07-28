<?php

namespace App\Http\Controllers;

use App\Caldav\AuthBackend;
use App\Caldav\CalendarBackend;
use App\Caldav\CalendarContext;
use App\Caldav\PrincipalBackend;
use App\Caldav\ResponseCapture;
use App\Services\CalendarFeed;
use App\Services\CalendarIcs;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Sabre\CalDAV\CalendarRoot;
use Sabre\CalDAV\Plugin as CalDavPlugin;
use Sabre\CalDAV\Principal\Collection as PrincipalCollection;
use Sabre\DAV\Auth\Plugin as AuthPlugin;
use Sabre\DAV\Server;
use Sabre\DAVACL\Plugin as AclPlugin;
use Sabre\HTTP\Request as SabreRequest;
use Sabre\HTTP\Response as SabreResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;

/**
 * A CalDAV-végpont: ezen keresztül szinkronizál a telefon natív naptára.
 *
 * A sabre/dav szervert kérésenként állítjuk össze, és a válaszát Laravel
 * válasszá alakítjuk ahelyett, hogy a sabre közvetlenül a kimenetre írna —
 * így a keretrendszer middleware-jei és hibakezelése épségben maradnak.
 */
class CaldavController extends Controller
{
    private const BASE_URI = '/caldav/';

    public function __invoke(Request $request, CalendarFeed $feed, CalendarIcs $ics): Response
    {
        $auth = new AuthBackend($request->ip());

        $server = new Server([
            new PrincipalCollection(new PrincipalBackend),
            new CalendarRoot(new PrincipalBackend, new CalendarBackend($feed, $ics)),
        ]);

        $server->setBaseUri(self::BASE_URI);

        // A sabre alapból a PHP kimenetére ír; ezzel a cserével a választ
        // objektumként kapjuk vissza.
        $capture = new ResponseCapture;
        $server->sapi = $capture;

        $server->httpRequest = $this->toSabreRequest($request);
        $server->httpResponse = new SabreResponse;

        $authPlugin = new AuthPlugin($auth);
        $server->addPlugin($authPlugin);
        $server->addPlugin(new CalDavPlugin);

        $acl = new AclPlugin;
        // A principal-fa nem címtár: a felhasználó a sajátján kívül mást nem lát.
        $acl->hideNodesFromInvisiblePrincipals = true;
        $server->addPlugin($acl);

        // A hitelesítés a sabre eseményláncában fut le, ezért a felhasználót
        // csak utána tudjuk a kéréshez kötni — a backendek innen olvassák.
        $server->on('beforeMethod:*', function () use ($auth) {
            CalendarContext::set($auth->authenticatedUser());
        }, 15);

        try {
            $server->start();
        } finally {
            $email = $auth->authenticatedUser()?->email;
            CalendarContext::clear();
        }

        $response = $this->toLaravelResponse($capture->response ?? $server->httpResponse);

        $this->logMutation($request, $response, $email ?? null);

        return $response;
    }

    /**
     * A telefon felől érkező módosítások naplózása.
     *
     * Csak az írásokat naplózzuk (a lekérdezéseket nem — azok percenként
     * futnak), mert a szinkron-hibáknál kívülről nem látszik, mit küldött
     * valójában a telefon: elküldte-e egyáltalán a törlést, és mit kapott rá.
     */
    private function logMutation(Request $request, Response $response, ?string $email): void
    {
        $method = $request->getMethod();

        if (in_array($method, ['GET', 'HEAD', 'OPTIONS', 'PROPFIND', 'REPORT'], true)) {
            return;
        }

        $status = $response->getStatusCode();

        Log::log($status >= 400 ? 'warning' : 'info', 'CalDAV '.$method, [
            'path' => $request->getPathInfo(),
            'user' => $email,
            'status' => $status,
            'agent' => $request->userAgent(),
            // Hiba esetén a sabre a válasz XML-jébe teszi az okot.
            'reason' => $status >= 400
                ? Str::limit(strip_tags($response->getContent() ?: ''), 300)
                : null,
        ]);
    }

    /**
     * Fiók-felfedezés: az iOS és a macOS a jól ismert útvonalon kezdi, ezért
     * elég a szerver nevét megadni a telefonon.
     *
     * A záró perjel szándékosan marad rajta — a Laravel `redirect()`-je
     * levágná, egyes CalDAV-kliensek viszont könyvtárként várják az útvonalat.
     */
    public function wellKnown(): RedirectResponse
    {
        return new RedirectResponse(self::BASE_URI, 301);
    }

    private function toSabreRequest(Request $request): SabreRequest
    {
        $headers = [];

        foreach ($request->headers->all() as $name => $values) {
            $headers[$name] = $values;
        }

        $sabreRequest = new SabreRequest(
            $request->getMethod(),
            $request->getRequestUri(),
            $headers,
        );

        $sabreRequest->setBody($request->getContent());

        return $sabreRequest;
    }

    private function toLaravelResponse(SabreResponse $sabreResponse): Response
    {
        $response = new Response(
            $sabreResponse->getBodyAsString(),
            $sabreResponse->getStatus(),
        );

        foreach ($sabreResponse->getHeaders() as $name => $values) {
            $response->headers->set($name, $values, replace: true);
        }

        return $response;
    }
}
