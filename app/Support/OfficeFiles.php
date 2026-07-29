<?php

namespace App\Support;

/**
 * Asztali Office-ban megnyitható fájltípusok.
 *
 * Az Office saját URI-sémákat regisztrál a Windowsban (`ms-excel:`, `ms-word:`
 * …); egy ilyen hivatkozásra a rendszer a telepített programmal nyitja meg a
 * megadott WebDAV-címet, és mentéskor oda is ír vissza.
 */
class OfficeFiles
{
    /** kiterjesztés => [URI-séma, program neve] */
    private const APPS = [
        'doc' => ['ms-word', 'Word'],
        'docx' => ['ms-word', 'Word'],
        'docm' => ['ms-word', 'Word'],
        'dot' => ['ms-word', 'Word'],
        'dotx' => ['ms-word', 'Word'],
        'rtf' => ['ms-word', 'Word'],
        'odt' => ['ms-word', 'Word'],

        'xls' => ['ms-excel', 'Excel'],
        'xlsx' => ['ms-excel', 'Excel'],
        'xlsm' => ['ms-excel', 'Excel'],
        'xlsb' => ['ms-excel', 'Excel'],
        'xltx' => ['ms-excel', 'Excel'],
        'csv' => ['ms-excel', 'Excel'],
        'ods' => ['ms-excel', 'Excel'],

        'ppt' => ['ms-powerpoint', 'PowerPoint'],
        'pptx' => ['ms-powerpoint', 'PowerPoint'],
        'pptm' => ['ms-powerpoint', 'PowerPoint'],
        'ppsx' => ['ms-powerpoint', 'PowerPoint'],
        'odp' => ['ms-powerpoint', 'PowerPoint'],

        'vsd' => ['ms-visio', 'Visio'],
        'vsdx' => ['ms-visio', 'Visio'],
    ];

    /**
     * A fájlnévhez tartozó program, vagy null, ha nem Office-fájl.
     *
     * @return array{scheme: string, label: string}|null
     */
    public static function appFor(?string $filename): ?array
    {
        $ext = strtolower(pathinfo((string) $filename, PATHINFO_EXTENSION));

        if ($ext === '' || ! isset(self::APPS[$ext])) {
            return null;
        }

        [$scheme, $label] = self::APPS[$ext];

        return ['scheme' => $scheme, 'label' => $label];
    }

    public static function isOfficeFile(?string $filename): bool
    {
        return self::appFor($filename) !== null;
    }

    /**
     * Megnyitó hivatkozás: `ms-excel:ofe|u|https://…` (ofe = szerkesztésre,
     * ofv = csak megtekintésre).
     */
    public static function uri(string $scheme, string $url, bool $editable): string
    {
        return $scheme.':'.($editable ? 'ofe' : 'ofv').'|u|'.$url;
    }

    /**
     * A kiterjesztéshez tartozó MIME-típus. Az Office ebből (is) dönt arról,
     * hogy szerkeszthetőnek tekinti-e a WebDAV-on kiszolgált fájlt.
     */
    public static function mimeFor(?string $filename, ?string $fallback = null): string
    {
        $ext = strtolower(pathinfo((string) $filename, PATHINFO_EXTENSION));

        return match ($ext) {
            'doc', 'dot' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'dotx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
            'docm' => 'application/vnd.ms-word.document.macroEnabled.12',
            'rtf' => 'application/rtf',
            'odt' => 'application/vnd.oasis.opendocument.text',

            'xls' => 'application/vnd.ms-excel',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xltx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
            'xlsm' => 'application/vnd.ms-excel.sheet.macroEnabled.12',
            'xlsb' => 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
            'csv' => 'text/csv',
            'ods' => 'application/vnd.oasis.opendocument.spreadsheet',

            'ppt' => 'application/vnd.ms-powerpoint',
            'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'ppsx' => 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
            'pptm' => 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
            'odp' => 'application/vnd.oasis.opendocument.presentation',

            'vsd', 'vsdx' => 'application/vnd.visio',

            default => $fallback ?: 'application/octet-stream',
        };
    }
}
