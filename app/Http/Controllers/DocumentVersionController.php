<?php

namespace App\Http\Controllers;

use App\Http\Requests\DocumentRequest;
use App\Models\Document;
use App\Models\DocumentVersion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class DocumentVersionController extends Controller
{
    /**
     * Új verzió feltöltése — a régi megmarad, az új lesz az aktuális (spec §10).
     */
    public function store(Request $request, Document $document): RedirectResponse
    {
        $data = $request->validate([
            'file' => [
                'required', 'file',
                'max:'.DocumentRequest::MAX_KB,
                'extensions:'.DocumentRequest::EXTENSIONS,
            ],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'file.required' => 'Válasszon ki egy fájlt a feltöltéshez.',
            'file.max' => 'A fájl túl nagy (legfeljebb 120 MB lehet).',
            'file.extensions' => 'Ez a fájltípus nem engedélyezett.',
        ]);

        $file = $request->file('file');
        $disk = Document::diskForCategory($document->category);

        DB::transaction(function () use ($document, $file, $disk, $data, $request) {
            $next = ((int) $document->versions()->max('version_number')) + 1;

            $document->versions()->update(['is_current' => false]);

            $path = $file->store("doc-{$document->id}", $disk);

            $document->versions()->create([
                'version_number' => $next,
                'is_current' => true,
                'disk' => $disk,
                'file_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'note' => $data['note'] ?? null,
                'uploaded_by' => $request->user()->id,
            ]);

            $document->touch();
        });

        $document->project?->logActivity('dokumentum', "Új verzió feltöltve: {$document->title}");

        return back()->with('success', 'Az új verzió feltöltve, mostantól ez az aktuális.');
    }

    /**
     * Régebbi verzió visszaállítása aktuálissá.
     */
    public function makeCurrent(DocumentVersion $version): RedirectResponse
    {
        DB::transaction(function () use ($version) {
            $version->document->versions()->update(['is_current' => false]);
            $version->update(['is_current' => true]);
            $version->document->touch();
        });

        return back()->with('success', "A(z) {$version->version_number}. verzió mostantól az aktuális.");
    }

    /**
     * Letöltés — a tárolás helye (szerver vagy S3) a felhasználó felé átlátszó.
     */
    public function download(DocumentVersion $version): SymfonyResponse
    {
        return $this->serve($version, inline: false);
    }

    /**
     * Előnézet (kép/PDF beágyazva).
     */
    public function preview(DocumentVersion $version): SymfonyResponse
    {
        abort_unless($version->isPreviewable(), 404);

        return $this->serve($version, inline: true);
    }

    private function serve(DocumentVersion $version, bool $inline): SymfonyResponse
    {
        $storage = Storage::disk($version->disk);

        abort_unless($storage->exists($version->file_path), 404, 'A fájl nem található a tárolón.');

        // S3-on tárolt fájl: időszakosan érvényes, aláírt (presigned) URL.
        if ($version->disk === 'plans') {
            $disposition = $inline ? 'inline' : 'attachment';

            return redirect()->away($storage->temporaryUrl(
                $version->file_path,
                now()->addMinutes(10),
                [
                    'ResponseContentDisposition' => $disposition.'; filename="'.rawurlencode($version->original_filename).'"',
                    'ResponseContentType' => $version->mime_type ?? 'application/octet-stream',
                ],
            ));
        }

        // Szerver-lemez: közvetlen kiszolgálás jogosultság-ellenőrzés után.
        if ($inline) {
            return $storage->response($version->file_path, $version->original_filename, [
                'Content-Type' => $version->mime_type ?? 'application/octet-stream',
            ]);
        }

        return $storage->download($version->file_path, $version->original_filename);
    }
}
