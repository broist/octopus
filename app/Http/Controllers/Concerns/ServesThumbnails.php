<?php

namespace App\Http\Controllers\Concerns;

use App\Services\Thumbnails;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Bélyegkép kiszolgálása jogosultság-ellenőrzés UTÁN.
 *
 * A hívó a `null` visszatérésnél az eredeti fájlt adja vissza (nem képformátum,
 * hiányzó GD-támogatás vagy sérült forrás esetén) — így a bélyegkép sosem
 * „nyeli el” a fájlt, csak gyorsítja.
 */
trait ServesThumbnails
{
    /** Böngészőben tartható ennyi ideig: a forrásfájlok nem változnak. */
    private const THUMB_MAX_AGE = 60 * 60 * 24 * 30;

    protected function thumbnailResponse(
        Request $request,
        string $key,
        string $disk,
        string $path,
        ?string $mime,
    ): ?BinaryFileResponse {
        $size = Thumbnails::normalizeSize($request->query('size'));

        $file = app(Thumbnails::class)->file($key, $size, $disk, $path, $mime);

        if ($file === null) {
            return null;
        }

        $response = new BinaryFileResponse($file, 200, [
            'Content-Type' => Thumbnails::mimeType(),
            'X-Content-Type-Options' => 'nosniff',
        ]);

        // Jogosultsághoz kötött tartalom: csak a felhasználó böngészője
        // tárolhatja, közbenső gyorsítótár (proxy) nem.
        $response->setPrivate();
        $response->setMaxAge(self::THUMB_MAX_AGE);
        $response->setEtag(sprintf('%s-%d-%d', $key, $size, (int) filemtime($file)));
        $response->isNotModified($request);

        return $response;
    }
}
