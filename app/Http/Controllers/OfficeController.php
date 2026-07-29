<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentEditSession;
use App\Models\Folder;
use App\Support\OfficeFiles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * „Megnyitás Wordben / Excelben”: megnyitó hivatkozás kiadása a fájlkezelőből.
 *
 * A hivatkozás egy rövid életű jegyet tartalmaz, amivel az asztali Office a
 * WebDAV-végponton eléri a fájlt (lásd OfficeWebdavController) — mentéskor a
 * dokumentum új verziót kap.
 */
class OfficeController extends Controller
{
    public function link(Request $request, Document $document): JsonResponse
    {
        $user = $request->user();

        abort_unless($document->isVisibleTo($user), 404);

        $version = $document->versions()->where('is_current', true)->first();

        if (! $version) {
            return response()->json([
                'message' => 'A dokumentumnak nincs elérhető verziója.',
            ], 422);
        }

        $app = OfficeFiles::appFor($version->original_filename);

        if ($app === null) {
            return response()->json([
                'message' => 'Ez a fájltípus nem nyitható meg Office-programmal.',
            ], 422);
        }

        $editable = Folder::canEditIn($user, $document->folder);

        [$session, $token] = DocumentEditSession::issue($user, $document);

        $url = url('/office/'.$token.'/'.rawurlencode($version->original_filename));

        return response()->json([
            'uri' => OfficeFiles::uri($app['scheme'], $url, $editable),
            'url' => $url,
            'app' => $app['label'],
            'editable' => $editable,
            'filename' => $version->original_filename,
            'expires_at' => $session->expires_at->toIso8601String(),
            // Az Office csak HTTPS-en ír vissza megbízhatóan; fejlesztői
            // (http) környezetben ezt jelezzük a felületnek.
            'secure' => str_starts_with($url, 'https://'),
        ]);
    }
}
