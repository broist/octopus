<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Kép-bélyegképek előállítása és lemezes gyorsítótárazása (GD-vel).
 *
 * Mobilon ez a legnagyobb nyereség: a fájlkezelő rácsnézete korábban minden
 * ikonhoz a TELJES méretű eredeti képet töltötte le — egy 30 telefonfotós
 * mappa így több száz megabájt volt. A bélyegkép ehelyett néhány tíz kilobájt.
 *
 * A bélyegkép az első kéréskor készül el, és a `thumbs` lemezen marad; a
 * forrásfájlok (dokumentum-verzió, napi jelentés fotó, hibafotó) sosem
 * változnak, ezért a kulcs az azonosítójuk, és a válasz agresszíven
 * gyorsítótárazható a böngészőben is.
 */
class Thumbnails
{
    /** Választható méretek: a bélyegkép leghosszabb éle képpontban. */
    public const SIZES = [160, 400, 1200];

    /** Alapértelmezett méret, ha a kérés nem (vagy rosszul) adja meg. */
    public const DEFAULT_SIZE = 400;

    /**
     * Legnagyobb feldolgozott forráskép (képpont). A GD képpontonként 4 bájtot
     * foglal, tehát 40 MP ≈ 160 MB — ez még belefér az 512 MB-os keretbe, de a
     * fölötti (pl. szkennelt óriásképek) fölöslegesen kockáztatná a memóriát.
     */
    private const MAX_SOURCE_PIXELS = 40_000_000;

    /** Ezekből tudunk bélyegképet készíteni. */
    private const MIMES = [
        'image/jpeg',
        'image/pjpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/x-ms-bmp',
    ];

    /**
     * Készíthető-e bélyegkép ilyen típusú fájlból?
     *
     * Az SVG szándékosan kimarad (mint az előnézetnél): rasztereznénk sem
     * tudjuk GD-vel, és beágyazott szkriptet hordozhat.
     */
    public static function supports(?string $mime): bool
    {
        return in_array(strtolower((string) $mime), self::MIMES, true)
            && function_exists('imagecreatetruecolor');
    }

    /** A kérésben kapott méret a megengedettekre igazítva. */
    public static function normalizeSize(mixed $size): int
    {
        $value = (int) $size;

        foreach (self::SIZES as $allowed) {
            if ($value <= $allowed) {
                return $allowed;
            }
        }

        return self::DEFAULT_SIZE;
    }

    /** A gyorsítótárazott bélyegkép kiterjesztése (a GD képességei szerint). */
    public static function extension(): string
    {
        return function_exists('imagewebp') ? 'webp' : 'jpg';
    }

    /** A bélyegkép MIME-típusa. */
    public static function mimeType(): string
    {
        return function_exists('imagewebp') ? 'image/webp' : 'image/jpeg';
    }

    /**
     * A kért bélyegkép abszolút útvonala; szükség esetén most készül el.
     *
     * @param  string  $key    stabil, ütközésmentes kulcs (pl. „docver-42”)
     * @param  string  $disk   a forrásfájl lemeze
     * @param  string  $path   a forrásfájl útvonala a lemezen
     * @return string|null     null, ha nem sikerült (a hívó az eredetit adja vissza)
     */
    public function file(string $key, int $size, string $disk, string $path, ?string $mime): ?string
    {
        if (! self::supports($mime)) {
            return null;
        }

        $size = self::normalizeSize($size);
        $target = $this->targetPath($key, $size);

        if (is_file($target) && filesize($target) > 0) {
            return $target;
        }

        $temp = null;
        try {
            $source = $this->sourceFile($disk, $path, $temp);

            if ($source === null) {
                return null;
            }

            return $this->render($source, $size, $target) ? $target : null;
        } catch (\Throwable $e) {
            Log::warning('Bélyegkép nem készült el', ['key' => $key, 'hiba' => $e->getMessage()]);

            return null;
        } finally {
            if ($temp !== null && is_file($temp)) {
                @unlink($temp);
            }
        }
    }

    /** Egy forráshoz tartozó összes gyorsítótárazott méret eldobása. */
    public function forget(string $key): void
    {
        foreach (self::SIZES as $size) {
            foreach (['webp', 'jpg'] as $ext) {
                $file = $this->root()."/{$this->shard($key)}/{$key}-{$size}.{$ext}";
                if (is_file($file)) {
                    @unlink($file);
                }
            }
        }
    }

    /* ------------------------------------------------------------------ */

    private function root(): string
    {
        return rtrim(Storage::disk('thumbs')->path(''), '/\\');
    }

    /**
     * Alkönyvtárba szórjuk a fájlokat: több tízezer bélyegkép egyetlen
     * könyvtárban a legtöbb fájlrendszeren érezhetően lassít.
     */
    private function shard(string $key): string
    {
        return substr(md5($key), 0, 2);
    }

    private function targetPath(string $key, int $size): string
    {
        $dir = $this->root().'/'.$this->shard($key);

        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        return "{$dir}/{$key}-{$size}.".self::extension();
    }

    /**
     * A forrásfájl helyi útvonala. S3-ról ideiglenes fájlba töltjük le — a
     * bélyegkép ettől kezdve helyben van, tehát ez forrásonként egyszeri.
     */
    private function sourceFile(string $disk, string $path, ?string &$temp): ?string
    {
        $storage = Storage::disk($disk);

        if (config("filesystems.disks.{$disk}.driver") === 'local') {
            $real = $storage->path($path);

            return is_file($real) ? $real : null;
        }

        $stream = $storage->readStream($path);

        if (! $stream) {
            return null;
        }

        $temp = tempnam(sys_get_temp_dir(), 'octothumb');
        $out = fopen($temp, 'wb');
        stream_copy_to_stream($stream, $out);
        fclose($out);
        fclose($stream);

        return $temp;
    }

    private function render(string $source, int $size, string $target): bool
    {
        $info = @getimagesize($source);

        if (! $info) {
            return false;
        }

        [$width, $height, $type] = $info;

        if ($width < 1 || $height < 1 || $width * $height > self::MAX_SOURCE_PIXELS) {
            return false;
        }

        $image = $this->open($source, $type);

        if (! $image) {
            return false;
        }

        try {
            // A telefonok a képet állva rögzítik, és csak EXIF-fel jelzik az
            // elforgatást — enélkül a bélyegkép oldalára dőlne.
            $image = $this->applyOrientation($image, $source, $type);

            $width = imagesx($image);
            $height = imagesy($image);

            // Sosem nagyítunk: a kicsi kép marad az eredeti méretén.
            $scale = min(1.0, $size / max($width, $height));
            $targetWidth = max(1, (int) round($width * $scale));
            $targetHeight = max(1, (int) round($height * $scale));

            $canvas = imagecreatetruecolor($targetWidth, $targetHeight);

            if (self::extension() === 'webp') {
                imagealphablending($canvas, false);
                imagesavealpha($canvas, true);
                imagefill($canvas, 0, 0, imagecolorallocatealpha($canvas, 0, 0, 0, 127));
            } else {
                // A JPEG nem tud átlátszóságot: fehérre lapítjuk.
                imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
            }

            imagecopyresampled(
                $canvas, $image,
                0, 0, 0, 0,
                $targetWidth, $targetHeight, $width, $height,
            );

            // Előbb ideiglenes fájlba írunk, és csak készen mozgatjuk a helyére:
            // egyszerre több kérés is kérheti ugyanazt a bélyegképet, és így
            // sosem olvasnak félkész fájlt.
            $staging = $target.'.'.bin2hex(random_bytes(4)).'.tmp';

            $ok = self::extension() === 'webp'
                ? imagewebp($canvas, $staging, 80)
                : imagejpeg($canvas, $staging, 82);

            imagedestroy($canvas);

            if (! $ok) {
                @unlink($staging);

                return false;
            }

            @chmod($staging, 0664);

            return rename($staging, $target);
        } finally {
            if ($image instanceof \GdImage) {
                imagedestroy($image);
            }
        }
    }

    private function open(string $source, int $type): \GdImage|false
    {
        return match ($type) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($source),
            IMAGETYPE_PNG => @imagecreatefrompng($source),
            IMAGETYPE_GIF => @imagecreatefromgif($source),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp')
                ? @imagecreatefromwebp($source)
                : false,
            IMAGETYPE_BMP => function_exists('imagecreatefrombmp')
                ? @imagecreatefrombmp($source)
                : false,
            default => false,
        };
    }

    /**
     * EXIF-orientáció alkalmazása. Ha az exif kiterjesztés nincs telepítve, a
     * kép forgatás nélkül marad — a bélyegkép így is használható.
     */
    private function applyOrientation(\GdImage $image, string $source, int $type): \GdImage
    {
        if ($type !== IMAGETYPE_JPEG || ! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data($source);
        $orientation = (int) ($exif['Orientation'] ?? 1);

        if ($orientation <= 1 || $orientation > 8) {
            return $image;
        }

        $rotate = match ($orientation) {
            3, 4 => 180,
            5, 6 => -90,
            7, 8 => 90,
            default => 0,
        };

        if ($rotate !== 0) {
            $rotated = imagerotate($image, $rotate, 0);
            if ($rotated) {
                imagedestroy($image);
                $image = $rotated;
            }
        }

        // A páros kódok tükrözöttek is.
        if (in_array($orientation, [2, 4, 5, 7], true)) {
            imageflip($image, IMG_FLIP_HORIZONTAL);
        }

        return $image;
    }
}
