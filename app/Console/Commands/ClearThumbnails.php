<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * A bélyegkép-gyorsítótár ürítése.
 *
 * A `storage/app/thumbs` tartalma tiszta gyorsítótár: bármikor eldobható, a
 * kép első megjelenítésekor újra elkészül a forrásfájlból. Akkor jó, ha kevés
 * a lemez, vagy ha a bélyegkép-előállítás beállításai (méret, minőség)
 * változtak.
 */
class ClearThumbnails extends Command
{
    protected $signature = 'thumbs:clear';

    protected $description = 'A bélyegkép-gyorsítótár törlése (magától újraépül)';

    public function handle(): int
    {
        $disk = Storage::disk('thumbs');
        $bytes = 0;
        $files = 0;

        foreach ($disk->allFiles() as $file) {
            $bytes += $disk->size($file);
            $files++;
        }

        foreach ($disk->directories() as $directory) {
            $disk->deleteDirectory($directory);
        }
        $disk->delete($disk->files());

        $this->info(sprintf(
            '%d bélyegkép törölve (%s felszabadítva). A képek első megnyitásakor újra elkészülnek.',
            $files,
            $bytes > 1048576
                ? round($bytes / 1048576, 1).' MB'
                : round($bytes / 1024).' KB',
        ));

        return self::SUCCESS;
    }
}
