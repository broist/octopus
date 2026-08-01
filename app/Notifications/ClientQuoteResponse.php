<?php

namespace App\Notifications;

use App\Models\Quote;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Felületi (harang) értesítés: a megrendelő nyilatkozott egy árajánlatról az
 * ügyfélportálon.
 */
class ClientQuoteResponse extends Notification
{
    use Queueable;

    public function __construct(
        public Quote $quote,
        public string $clientName,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        $accepted = $this->quote->client_response === 'elfogadva';

        return [
            'title' => $accepted ? 'Árajánlat elfogadva' : 'Árajánlat elutasítva',
            'body' => sprintf(
                '%s – %s (%s)',
                $this->clientName,
                $this->quote->project_name,
                $this->quote->quote_number ?: 'ajánlatszám nélkül',
            ),
            'url' => "/ajanlatok/{$this->quote->id}?tab=ugyfel",
        ];
    }
}
