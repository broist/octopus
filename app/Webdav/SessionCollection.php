<?php

namespace App\Webdav;

use App\Models\DocumentEditSession;
use Sabre\DAV;

/**
 * A megnyitó jegyhez tartozó „mappa”: pontosan egy fájlt tartalmaz.
 *
 * Az Office a megnyitás előtt a befoglaló mappát is megkérdezi (PROPFIND),
 * ezért nem elég a fájlt önmagában kiszolgálni — de a fa szándékosan itt véget
 * is ér: egy jegy egy dokumentumot lát, semmi mást.
 */
class SessionCollection extends DAV\Collection
{
    private DocumentFile $file;

    public function __construct(private DocumentEditSession $session)
    {
        $this->file = new DocumentFile($session);
    }

    public function getName(): string
    {
        return (string) $this->session->id;
    }

    /**
     * @return array<int, DAV\INode>
     */
    public function getChildren(): array
    {
        return [$this->file];
    }

    public function getChild($name): DAV\INode
    {
        if ($name !== $this->file->getName()) {
            throw new DAV\Exception\NotFound("Nincs ilyen fájl: {$name}");
        }

        return $this->file;
    }

    public function childExists($name): bool
    {
        return $name === $this->file->getName();
    }

    public function createFile($name, $data = null): ?string
    {
        throw new DAV\Exception\Forbidden('Ide nem lehet új fájlt létrehozni.');
    }

    public function createDirectory($name): void
    {
        throw new DAV\Exception\Forbidden('Ide nem lehet mappát létrehozni.');
    }

    public function getLastModified(): ?int
    {
        return $this->file->getLastModified();
    }
}
