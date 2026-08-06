<?php

namespace App\Console\Commands;

use App\Services\LedgerIngestor;
use Illuminate\Console\Command;

/**
 * A Tagi kölcsön modul automatikus tételei.
 *
 *  - A Fájlkezelő figyelt mappájába (Pénzügy → Könyvelő) került, még fel nem
 *    dolgozott számla PDF-ekből esedékes befizetés-sor.
 *  - Az ismétlődő sablonokból (pl. ChatGPT-előfizetés) a havi tétel.
 *
 * Feltöltéskor a DocumentController már azonnal megpróbálja feldolgozni a
 * PDF-et; ez a parancs az utószedés — arra az esetre, ha a fájl máshonnan
 * (áthelyezés, WebDAV, másolás) került a mappába, vagy a feldolgozás elhasalt.
 */
class ScanLedgerInvoices extends Command
{
    protected $signature = 'ledger:scan';

    protected $description = 'Számla PDF-ek és ismétlődő tételek beolvasása a tagi kölcsön nyilvántartásba';

    public function handle(LedgerIngestor $ingestor): int
    {
        $fromPdf = $ingestor->scan();
        $recurring = $ingestor->generateRecurring();

        $this->info("Számlából: {$fromPdf} új tétel, ismétlődőből: {$recurring} új tétel.");

        return self::SUCCESS;
    }
}
