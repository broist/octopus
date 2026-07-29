<?php

namespace App\Http\Controllers;

use App\Caldav\ResponseCapture;
use App\Models\DocumentEditSession;
use App\Webdav\SessionCollection;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Sabre\DAV\Locks\Backend\File as LockBackend;
use Sabre\DAV\Locks\Plugin as LocksPlugin;
use Sabre\DAV\Server;
use Sabre\DAV\TemporaryFileFilterPlugin;
use Sabre\HTTP\Request as SabreRequest;
use Sabre\HTTP\Response as SabreResponse;

/**
 * WebDAV-végpont az asztali Office-ban való szerkesztéshez.
 *
 * Az Office (és a Windows WebDAV-rétege) NEM küld munkamenet-sütit — ugyanaz a
 * lecke, mint a mobil fájlletöltésnél. Ezért itt nincs `web` middleware: a
 * hozzáférést az URL-ben lévő rövid életű jegy adja, a mentés jogát pedig a
 * mappa-jogosultság dönti el minden PUT-nál.
 */
class OfficeWebdavController extends Controller
{
    public function __invoke(Request $request, string $token): Response
    {
        $session = DocumentEditSession::findActive($token);

        // Lejárt/visszavont jegy vagy időközben elvett jogosultság: az Office
        // felé egységesen „nincs ilyen fájl”, hogy semmit ne áruljunk el.
        if (! $session || ! $session->user || ! $session->document->isVisibleTo($session->user)) {
            return new Response('Not Found', 404);
        }

        $session->touchUsage($request->ip());

        // FONTOS: a csomópontot közvetlenül adjuk át. Tömbként a sabre még egy
        // „root” gyűjteményt húzna fölé, és a fájl egy szinttel lejjebb kerülne.
        $server = new Server(new SessionCollection($session));
        $server->setBaseUri('/office/'.$token.'/');

        // A sabre alapból a PHP kimenetére ír; így objektumként kapjuk vissza.
        $capture = new ResponseCapture;
        $server->sapi = $capture;

        $server->httpRequest = $this->toSabreRequest($request);
        $server->httpResponse = new SabreResponse;

        // Az Office zárolja a fájlt szerkesztés közben: LOCK/UNLOCK nélkül
        // csak olvasásra nyitná meg.
        File::ensureDirectoryExists(storage_path('app/webdav'));
        $server->addPlugin(new LocksPlugin(new LockBackend(storage_path('app/webdav/locks.dat'))));

        // Az Office munka közben ideiglenes fájlokat (~$… .tmp) próbál írni a
        // dokumentum mellé; ezeket külön tároljuk, nem a dokumentumfába.
        File::ensureDirectoryExists(storage_path('app/webdav/temp'));
        $server->addPlugin(new TemporaryFileFilterPlugin(storage_path('app/webdav/temp')));

        $server->start();

        $response = $this->toLaravelResponse($capture->response ?? $server->httpResponse);

        $this->logMutation($request, $response, $session);

        return $response;
    }

    /**
     * Az írásokat naplózzuk: ha egy mentés nem jut vissza az Octopusba, kívülről
     * nem látszik, mit küldött az Office és mit kapott rá.
     */
    private function logMutation(Request $request, Response $response, DocumentEditSession $session): void
    {
        if (in_array($request->getMethod(), ['GET', 'HEAD', 'OPTIONS', 'PROPFIND'], true)) {
            return;
        }

        $status = $response->getStatusCode();

        Log::log($status >= 400 ? 'warning' : 'info', 'Office WebDAV '.$request->getMethod(), [
            'document' => $session->document_id,
            'user' => $session->user?->email,
            'status' => $status,
            'agent' => $request->userAgent(),
            'reason' => $status >= 400
                ? Str::limit(strip_tags($response->getContent() ?: ''), 300)
                : null,
        ]);
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

        // Streamként adjuk tovább: egy nagyobb táblázat így sem terheli a memóriát.
        $sabreRequest->setBody($request->getContent(asResource: true));

        return $sabreRequest;
    }

    private function toLaravelResponse(SabreResponse $sabreResponse): Response
    {
        $body = $sabreResponse->getBody();

        $response = new Response(
            is_resource($body) ? stream_get_contents($body) : (string) $body,
            $sabreResponse->getStatus(),
        );

        foreach ($sabreResponse->getHeaders() as $name => $values) {
            $response->headers->set($name, $values, replace: true);
        }

        return $response;
    }
}
