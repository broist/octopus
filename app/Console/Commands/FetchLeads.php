<?php

namespace App\Console\Commands;

use App\Services\LeadIngestor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Webklex\PHPIMAP\ClientManager;

/**
 * Az acuwall@acuwall.hu postafiók figyelése: az ajánlatkérő űrlap leveleiből
 * automatikus projekt + felületi értesítés készül.
 *
 * Ütemezve percenként fut (routes/console.php); amíg a LEADS_IMAP_* beállítások
 * üresek, csendben kilép. Kézi teszthez: leads:fetch --file=minta.txt
 */
class FetchLeads extends Command
{
    protected $signature = 'leads:fetch {--file= : E-mail törzs feldolgozása fájlból (teszt)}';

    protected $description = 'Ajánlatkérő e-mailek beolvasása IMAP-on és projektté alakítása';

    public function handle(LeadIngestor $ingestor): int
    {
        if ($file = $this->option('file')) {
            return $this->ingestFile($ingestor, $file);
        }

        $host = config('leads.imap.host');
        if (! $host) {
            $this->line('LEADS_IMAP_HOST nincs beállítva — a postafiók-figyelés kihagyva.');

            return self::SUCCESS;
        }

        try {
            $client = (new ClientManager())->make([
                'host' => $host,
                'port' => (int) config('leads.imap.port', 993),
                'encryption' => config('leads.imap.encryption', 'ssl'),
                'validate_cert' => (bool) config('leads.imap.validate_cert', true),
                'username' => config('leads.imap.username'),
                'password' => config('leads.imap.password'),
                'protocol' => 'imap',
            ]);
            $client->connect();

            $folder = $client->getFolderByPath(config('leads.imap.folder', 'INBOX'));

            // Az elmúlt napok levelei; a duplikáció-védelem (lead_id) miatt a
            // már feldolgozottak kihagyása automatikus — így az sem baj, ha a
            // levelet közben valaki kézzel elolvasta.
            $messages = $folder->messages()
                ->since(now()->subDays((int) config('leads.imap.lookback_days', 7)))
                ->text('Lead ID')
                ->leaveUnread()
                ->limit(100)
                ->get();

            $new = 0;
            foreach ($messages as $message) {
                $body = $message->hasHTMLBody()
                    ? $message->getHTMLBody()
                    : $message->getTextBody();

                $receivedAt = $message->getDate()?->toDate();

                $lead = $ingestor->ingestText((string) $body, 'email', $receivedAt);

                if ($lead && $lead->wasRecentlyCreated) {
                    $new++;
                    $this->info("Új lead: {$lead->lead_id} → projekt #{$lead->project_id}");
                }
            }

            $client->disconnect();

            $this->line("Kész. Új lead: {$new}, átnézett levél: ".count($messages).'.');

            return self::SUCCESS;
        } catch (\Throwable $e) {
            Log::error('Lead IMAP hiba: '.$e->getMessage());
            $this->error('IMAP hiba: '.$e->getMessage());

            return self::FAILURE;
        }
    }

    private function ingestFile(LeadIngestor $ingestor, string $path): int
    {
        if (! is_file($path)) {
            $this->error("A fájl nem található: {$path}");

            return self::FAILURE;
        }

        $lead = $ingestor->ingestText((string) file_get_contents($path), 'email');

        if (! $lead) {
            $this->warn('A fájlban nem található Lead ID — nem ajánlatkérő levél.');

            return self::FAILURE;
        }

        $this->info(($lead->wasRecentlyCreated ? 'Új lead: ' : 'Már létező lead: ')
            ."{$lead->lead_id} → projekt #{$lead->project_id}");

        return self::SUCCESS;
    }
}
