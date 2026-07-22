<?php

namespace App\Notifications;

use App\Models\Announcement;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Felületi értesítés új üzenőfali bejegyzésről (vezetői kiértesítés).
 */
class AnnouncementPosted extends Notification
{
    use Queueable;

    public function __construct(public Announcement $announcement)
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
        return [
            'title' => 'Új üzenőfali bejegyzés',
            'body' => $this->announcement->title,
            'url' => '/communication',
        ];
    }
}
