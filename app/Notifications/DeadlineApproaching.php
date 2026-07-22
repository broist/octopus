<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Felületi (harang) értesítés közelgő vagy lejárt határidőről
 * (feladat vagy ütemterv-fázis).
 */
class DeadlineApproaching extends Notification
{
    use Queueable;

    /**
     * @param  string  $kind   'feladat' | 'fazis'
     * @param  string  $dedupeKey  egyedi kulcs a napi duplikáció ellen
     */
    public function __construct(
        public string $kind,
        public string $title,
        public string $dueOn,
        public bool $overdue,
        public string $url,
        public string $dedupeKey,
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
        $label = $this->kind === 'fazis' ? 'Ütemterv-határidő' : 'Feladat határidő';
        $when = $this->overdue ? 'lejárt' : 'közeleg';

        return [
            'title' => "{$label} {$when}",
            'body' => "{$this->title} — határidő: {$this->dueOn}",
            'url' => $this->url,
            'dedupe' => $this->dedupeKey,
        ];
    }
}
