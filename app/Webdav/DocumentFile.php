<?php

namespace App\Webdav;

use App\Http\Requests\DocumentRequest;
use App\Models\DocumentEditSession;
use App\Models\DocumentVersion;
use App\Models\Folder;
use App\Support\OfficeFiles;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Sabre\DAV;

/**
 * A szerkesztésre megnyitott dokumentum egyetlen WebDAV-fájlként.
 *
 * Az Office ezen keresztül olvassa és menti a fájlt. Egy megnyitás EGY új
 * verziót hoz létre: az első mentés készíti, a további mentések ugyanazt írják
 * felül — különben minden Ctrl+S külön verzió lenne a dokumentum előzményében.
 */
class DocumentFile extends DAV\File
{
    public function __construct(private DocumentEditSession $session) {}

    public function getName(): string
    {
        return $this->filename();
    }

    /**
     * A megjelenő fájlnév. Kiterjesztés nélkül az Office nem tudná, milyen
     * programmal nyissa meg, ezért a dokumentum címéhez hozzáfűzzük.
     */
    public function filename(): string
    {
        $version = $this->currentVersion();
        $name = $version?->original_filename ?: $this->session->document->title;

        return $name !== '' ? $name : 'dokumentum';
    }

    public function get()
    {
        $version = $this->currentVersion();

        if (! $version) {
            throw new DAV\Exception\NotFound('A dokumentumnak nincs elérhető verziója.');
        }

        $disk = Storage::disk($version->disk);

        if (! $disk->exists($version->file_path)) {
            throw new DAV\Exception\NotFound('A fájl nem található a tárolón.');
        }

        return $disk->readStream($version->file_path);
    }

    /**
     * Mentés az Office-ból.
     */
    public function put($data): ?string
    {
        $session = $this->session;
        $document = $session->document;
        $user = $session->user;

        // A jegy csak megnyitásra jogosít: a mentéshez a mappa-jogosultságot
        // minden alkalommal újra ellenőrizzük, hogy a jog elvétele azonnal hasson.
        if (! $user || ! Folder::canEditIn($user, $document->folder)) {
            throw new DAV\Exception\Forbidden('Nincs jogosultsága menteni ebbe a mappába.');
        }

        $previous = $this->currentVersion();
        $reuse = $session->version_id !== null && $previous?->id === $session->version_id;

        $disk = $previous?->disk ?? \App\Models\Document::diskFor($document->category);
        $path = $reuse
            ? $previous->file_path
            : "doc-{$document->id}/".Str::random(40).'.'.$this->extension();

        Storage::disk($disk)->put($path, $data);
        $size = (int) Storage::disk($disk)->size($path);

        if ($size > DocumentRequest::MAX_KB * 1024) {
            if (! $reuse) {
                Storage::disk($disk)->delete($path);
            }

            throw new DAV\Exception\Forbidden('A fájl túl nagy (legfeljebb 120 MB lehet).');
        }

        DB::transaction(function () use ($session, $document, $previous, $reuse, $disk, $path, $size, $user) {
            if ($reuse) {
                $previous->forceFill([
                    'size_bytes' => $size,
                    'updated_at' => now(),
                ])->save();

                return;
            }

            $next = ((int) $document->versions()->max('version_number')) + 1;
            $document->versions()->update(['is_current' => false]);

            $version = $document->versions()->create([
                'version_number' => $next,
                'is_current' => true,
                'disk' => $disk,
                'file_path' => $path,
                'original_filename' => $previous?->original_filename ?? $this->filename(),
                'mime_type' => OfficeFiles::mimeFor($this->filename(), $previous?->mime_type),
                'size_bytes' => $size,
                'note' => 'Szerkesztve asztali Office-ban',
                'uploaded_by' => $user->id,
            ]);

            $session->forceFill(['version_id' => $version->id])->save();
        });

        $document->touch();
        $document->project?->logActivity(
            'dokumentum',
            "Dokumentum szerkesztve: {$document->title}",
        );

        return '"'.$this->etagFor($size).'"';
    }

    public function getSize(): int
    {
        return (int) ($this->currentVersion()?->size_bytes ?? 0);
    }

    public function getETag(): ?string
    {
        return '"'.$this->etagFor($this->getSize()).'"';
    }

    public function getContentType(): ?string
    {
        return OfficeFiles::mimeFor($this->filename(), $this->currentVersion()?->mime_type);
    }

    public function getLastModified(): ?int
    {
        $version = $this->currentVersion();

        return ($version?->updated_at ?? $this->session->document->updated_at)?->getTimestamp();
    }

    public function delete(): void
    {
        // A törlés az Octopus felületén megy, WebDAV-on át szándékosan nem.
        throw new DAV\Exception\Forbidden('A fájl törlése itt nem lehetséges.');
    }

    public function setName($name): void
    {
        throw new DAV\Exception\Forbidden('Az átnevezés az Octopusban lehetséges.');
    }

    private function currentVersion(): ?DocumentVersion
    {
        return $this->session->document->versions()->where('is_current', true)->first();
    }

    private function extension(): string
    {
        $ext = pathinfo($this->filename(), PATHINFO_EXTENSION);

        return $ext !== '' ? strtolower($ext) : 'bin';
    }

    private function etagFor(int $size): string
    {
        return md5(implode('|', [
            $this->session->document_id,
            $this->currentVersion()?->id,
            $size,
            $this->getLastModifiedRaw(),
        ]));
    }

    private function getLastModifiedRaw(): string
    {
        return (string) ($this->currentVersion()?->updated_at?->getTimestamp() ?? 0);
    }
}
