<?php

namespace App\Services;

use App\Models\CompanyMember;
use App\Models\Document;
use App\Models\Folder;
use App\Models\RecurringSharedCost;
use App\Models\SharedCost;
use App\Notifications\SharedCostCreated;
use App\Support\MemberLedger;
use App\Support\Settings;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * A közös költségek automatikus keletkezése.
 *
 *  1. A Fájlkezelő FIGYELT mappájába (alapból
 *     „AcuWall Kft. Belső / 02_PÉNZÜGY_ÉS_KÖNYVELÉS / Konyvelo”) feltöltött
 *     PDF-ekből havonta egy esedékes befizetés-sor keletkezik, a tagokra
 *     lebontva.
 *  2. Az ismétlődő sablonokból (pl. ChatGPT-előfizetés) havonta egy sor.
 *
 * Mindkettő IDEMPOTENS: a feldolgozott dokumentumot a shared_costs.document_id
 * jelöli (egyedi index), az ismétlődőt a last_period. Így a feltöltéskori
 * azonnali feldolgozás és az ütemezett utószedés nem duplikál.
 */
class LedgerIngestor
{
    /** A figyelt mappa alatt hány szintig keresünk PDF-et. */
    private const SCAN_DEPTH = 4;

    public function __construct(private AccountingInvoiceParser $parser) {}

    /* ------------------------------------------------------------------ */
    /* Figyelt mappa */
    /* ------------------------------------------------------------------ */

    /**
     * A figyelt mappa: a beállított, vagy — ha nincs beállítva — az
     * alapértelmezett útvonalon megtalált mappa.
     */
    public function watchFolder(): ?Folder
    {
        $id = Settings::get(MemberLedger::SETTING_WATCH_FOLDER);

        if ($id && $folder = Folder::find($id)) {
            return $folder;
        }

        return $this->folderByPath(MemberLedger::DEFAULT_WATCH_PATH);
    }

    /**
     * Mappa keresése „A/B/C” útvonal alapján, kis-nagybetű függetlenül.
     */
    public function folderByPath(string $path): ?Folder
    {
        $parent = null;

        foreach (preg_split('#[\\\\/]+#', $path) ?: [] as $segment) {
            $segment = trim($segment);
            if ($segment === '') {
                continue;
            }

            $found = Folder::query()
                ->where('parent_id', $parent?->id)
                ->whereRaw('lower(name) = lower(?)', [$segment])
                ->first();

            if (! $found) {
                return null;
            }

            $parent = $found;
        }

        return $parent;
    }

    /* ------------------------------------------------------------------ */
    /* PDF → közös költség */
    /* ------------------------------------------------------------------ */

    /**
     * A figyelt mappa (és almappái) még fel nem dolgozott PDF-jei.
     *
     * @return int a létrehozott sorok száma
     */
    public function scan(): int
    {
        $folder = $this->watchFolder();
        if (! $folder) {
            return 0;
        }

        $folderIds = $this->descendantIds($folder);

        // A soft-deleted sorokat is nézzük: amit a felhasználó kézzel törölt,
        // azt nem hozzuk vissza.
        $processed = SharedCost::withTrashed()
            ->whereNotNull('document_id')
            ->pluck('document_id')
            ->all();

        $documents = Document::query()
            ->whereIn('folder_id', $folderIds)
            ->whereNotIn('id', $processed ?: [0])
            ->with('currentVersion')
            ->orderBy('id')
            ->get();

        $created = 0;
        foreach ($documents as $document) {
            if ($this->ingestDocument($document)) {
                $created++;
            }
        }

        return $created;
    }

    /**
     * Egy dokumentum feldolgozása, ha PDF és a figyelt mappában van.
     *
     * Hibát sosem dob tovább: a feltöltésnek akkor is sikerülnie kell, ha a
     * számla nem olvasható ki.
     */
    public function ingestDocument(Document $document): ?SharedCost
    {
        try {
            return $this->ingest($document);
        } catch (Throwable $e) {
            Log::warning('Számla feldolgozása sikertelen', [
                'document_id' => $document->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Feltöltés utáni azonnali feldolgozás — csak akkor csinál bármit, ha a
     * dokumentum tényleg a figyelt mappában van.
     */
    public function ingestIfWatched(Document $document): ?SharedCost
    {
        if ($document->folder_id === null) {
            return null;
        }

        $folder = $this->watchFolder();
        if (! $folder || ! in_array($document->folder_id, $this->descendantIds($folder), true)) {
            return null;
        }

        return $this->ingestDocument($document);
    }

    private function ingest(Document $document): ?SharedCost
    {
        $version = $document->currentVersion()->first();
        if (! $version || ! $this->isPdf($version->mime_type, $version->original_filename)) {
            return null;
        }

        if (SharedCost::withTrashed()->where('document_id', $document->id)->exists()) {
            return null;
        }

        $data = $this->parseVersion($version->disk, $version->file_path);
        if ($data === null || $data['gross'] === null || $data['gross'] <= 0) {
            Log::info('A figyelt mappába került PDF-ből nem sikerült számlaösszeget kiolvasni', [
                'document_id' => $document->id,
            ]);

            return null;
        }

        $members = CompanyMember::query()->active()->orderBy('sort_order')->orderBy('id')->get();
        if ($members->isEmpty()) {
            Log::info('Nincs aktív cégtag, a számlából nem készül felosztás', [
                'document_id' => $document->id,
            ]);

            return null;
        }

        $due = $data['due_on']
            ?? CarbonImmutable::parse($data['issued_on'] ?? now())->addDays(8)->toDateString();

        $cost = DB::transaction(function () use ($data, $document, $due, $members) {
            $cost = SharedCost::create([
                'title' => $data['title'],
                'category' => $data['category'],
                'period_month' => $data['period_month'],
                'due_on' => $due,
                'issued_on' => $data['issued_on'],
                'currency' => $data['currency'],
                'amount' => $data['gross'],
                'net_amount' => $data['net'],
                'vat_amount' => $data['vat'],
                'exchange_rate' => 1,
                'amount_huf' => $data['currency'] === 'HUF' ? $data['gross'] : 0,
                'supplier_name' => $data['supplier_name'],
                'invoice_number' => $data['invoice_number'],
                'source' => 'pdf',
                'document_id' => $document->id,
                'needs_review' => $data['missing'] !== [] || $data['currency'] !== 'HUF',
                'parse_note' => $this->reviewNote($data),
                'created_by' => $document->uploaded_by,
            ]);

            $this->applyShares($cost, $this->defaultShareMap($members));

            return $cost;
        });

        $this->notifyMembers($cost);

        return $cost;
    }

    /**
     * A tárolt fájl kiolvasása. Az S3-ra került fájlt előbb ideiglenes helyi
     * másolatba tesszük — a PDF-olvasó fájlútvonalat vár.
     *
     * @return array<string, mixed>|null
     */
    private function parseVersion(string $disk, string $path): ?array
    {
        $storage = Storage::disk($disk);

        if (! $storage->exists($path)) {
            return null;
        }

        if ($disk === 'documents') {
            return $this->parser->parseFile($storage->path($path));
        }

        $temp = tempnam(sys_get_temp_dir(), 'invoice_').'.pdf';

        try {
            file_put_contents($temp, $storage->get($path));

            return $this->parser->parseFile($temp);
        } finally {
            @unlink($temp);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function reviewNote(array $data): ?string
    {
        $notes = [];

        if ($data['missing'] !== []) {
            $notes[] = 'A PDF-ből nem sikerült kiolvasni: '.implode(', ', $data['missing']).'.';
        }

        if ($data['currency'] !== 'HUF') {
            $notes[] = 'Devizás számla — adja meg az árfolyamot a felosztáshoz.';
        }

        return $notes === [] ? null : implode(' ', $notes);
    }

    private function isPdf(?string $mime, ?string $filename): bool
    {
        if ($mime === 'application/pdf') {
            return true;
        }

        return str_ends_with(mb_strtolower((string) $filename), '.pdf');
    }

    /**
     * A mappa és összes (korlátozott mélységű) leszármazottja.
     *
     * @return array<int, int>
     */
    public function descendantIds(Folder $folder): array
    {
        $ids = [$folder->id];
        $frontier = [$folder->id];

        for ($depth = 0; $depth < self::SCAN_DEPTH && $frontier !== []; $depth++) {
            $frontier = Folder::whereIn('parent_id', $frontier)->pluck('id')->all();
            $ids = array_merge($ids, $frontier);
        }

        return $ids;
    }

    /* ------------------------------------------------------------------ */
    /* Ismétlődő költségek */
    /* ------------------------------------------------------------------ */

    /**
     * Az esedékes ismétlődő sorok legyártása (havonta egy, visszamenőleg is
     * pótolva, ha az ütemező kimaradt).
     *
     * @return int a létrehozott sorok száma
     */
    public function generateRecurring(?CarbonImmutable $now = null): int
    {
        $now = $now ?? CarbonImmutable::now();
        $thisMonth = $now->startOfMonth();
        $created = 0;

        foreach (RecurringSharedCost::where('is_active', true)->get() as $template) {
            $start = $template->start_month
                ? CarbonImmutable::parse($template->start_month)->startOfMonth()
                : $thisMonth;

            $period = $template->last_period
                ? CarbonImmutable::parse($template->last_period)->startOfMonth()->addMonthNoOverflow()
                : $start;

            // Biztonsági korlát: legfeljebb 24 hónapot pótolunk visszamenőleg.
            $guard = 0;
            while ($period <= $thisMonth && $guard++ < 24) {
                if ($this->createFromTemplate($template, $period)) {
                    $created++;
                }
                $period = $period->addMonthNoOverflow();
            }
        }

        return $created;
    }

    private function createFromTemplate(RecurringSharedCost $template, CarbonImmutable $period): bool
    {
        $exists = SharedCost::withTrashed()
            ->where('recurring_cost_id', $template->id)
            ->whereDate('period_month', $period->toDateString())
            ->exists();

        if ($exists) {
            $template->update(['last_period' => $period->toDateString()]);

            return false;
        }

        $shareMap = $template->shareMap();
        if ($shareMap === []) {
            $members = CompanyMember::query()->active()->orderBy('sort_order')->orderBy('id')->get();
            $shareMap = $this->defaultShareMap($members);
        }

        if ($shareMap === []) {
            return false;
        }

        $day = min(max($template->due_day, 1), $period->daysInMonth);

        $cost = DB::transaction(function () use ($template, $period, $day, $shareMap) {
            $cost = SharedCost::create([
                'title' => $template->title.' – '.$period->year.'. '.MemberLedger::MONTHS_HU[$period->month],
                'category' => $template->category,
                'period_month' => $period->toDateString(),
                'due_on' => $period->setDay($day)->toDateString(),
                'currency' => $template->currency,
                'amount' => $template->amount,
                'exchange_rate' => $template->exchange_rate,
                'amount_huf' => MemberLedger::toHuf($template->amount, $template->currency, $template->exchange_rate),
                'source' => 'ismetlodo',
                'recurring_cost_id' => $template->id,
                'note' => $template->note,
                'created_by' => $template->created_by,
            ]);

            $this->applyShares($cost, $shareMap);

            $template->update(['last_period' => $period->toDateString()]);

            return $cost;
        });

        $this->notifyMembers($cost);

        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Felosztás */
    /* ------------------------------------------------------------------ */

    /**
     * A tagok alapértelmezett részesedése.
     *
     * @param  Collection<int, CompanyMember>  $members
     * @return array<int, float>
     */
    public function defaultShareMap($members): array
    {
        $map = [];

        foreach ($members as $member) {
            if ($member->default_share > 0) {
                $map[$member->id] = $member->default_share;
            }
        }

        return $map;
    }

    /**
     * A költség felosztásának (újra)számolása: a százalékokból pontos, kerekítési
     * maradék nélkül összeadódó összegek lesznek.
     *
     * @param  array<int, float>  $shareMap  tag-azonosító → százalék
     */
    public function applyShares(SharedCost $cost, array $shareMap): void
    {
        $shareMap = array_filter($shareMap, fn ($percent) => $percent > 0);

        $cost->shares()->whereNotIn('company_member_id', array_keys($shareMap) ?: [0])->delete();

        if ($shareMap === []) {
            return;
        }

        $amounts = MemberLedger::split((float) $cost->amount, $shareMap, $cost->currency);
        $hufAmounts = MemberLedger::split((float) $cost->amount_huf, $shareMap, 'HUF');

        foreach ($shareMap as $memberId => $percent) {
            $cost->shares()->updateOrCreate(
                ['company_member_id' => $memberId],
                [
                    'share_percent' => $percent,
                    'amount' => $amounts[$memberId] ?? 0,
                    'amount_huf' => $hufAmounts[$memberId] ?? 0,
                ],
            );
        }
    }

    /* ------------------------------------------------------------------ */
    /* Értesítés */
    /* ------------------------------------------------------------------ */

    /**
     * Harang-értesítés az érintett tagoknak, akiknek van Octopus-fiókjuk.
     */
    private function notifyMembers(SharedCost $cost): void
    {
        $users = CompanyMember::query()
            ->active()
            ->whereNotNull('user_id')
            ->whereIn('id', $cost->shares()->pluck('company_member_id'))
            ->with('user')
            ->get()
            ->pluck('user')
            ->filter();

        if ($users->isEmpty()) {
            return;
        }

        Notification::send($users, new SharedCostCreated($cost));
    }
}
