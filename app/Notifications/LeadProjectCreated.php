<?php

namespace App\Notifications;

use App\Models\Lead;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Felületi (harang) értesítés: webes ajánlatkérésből új projekt készült.
 */
class LeadProjectCreated extends Notification
{
    use Queueable;

    public function __construct(public Lead $lead)
    {
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
        $parts = array_filter([
            $this->lead->name,
            $this->lead->location,
        ]);

        return [
            'title' => 'Új ajánlatkérés érkezett',
            'body' => implode(' – ', $parts).' ('.$this->lead->lead_id.')',
            'url' => $this->lead->project_id ? "/projects/{$this->lead->project_id}" : '/projects',
        ];
    }
}
