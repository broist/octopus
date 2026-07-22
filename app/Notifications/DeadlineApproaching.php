<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Felületi (harang) értesítés közelgő vagy lejárt határidőről
 * (feladat, ütemterv-fázis, alvállalkozói/munkatársi dokumentum).
 *
 * Tételenként+állapotonként egyszer szól (dedupe). A feladat-határidőkről a
 * felelős(ök) NAPI, tömbösített e-mailt is kapnak — azt külön a
 * TaskDeadlineDigest kezeli, nem ez.
 */
class DeadlineApproaching extends Notification
{
    use Queueable;

    /**
     * @param  string  $kind   'feladat' | 'fazis' | 'tanusitvany' | 'kepesites'
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
        $label = match ($this->kind) {
            'fazis' => 'Ütemterv-határidő',
            'tanusitvany' => 'Alvállalkozói dokumentum',
            'kepesites' => 'Munkatárs végzettség / jogosultság',
            default => 'Feladat határidő',
        };
        $when = $this->overdue ? 'lejárt' : 'közeleg';
        $dateLabel = in_array($this->kind, ['tanusitvany', 'kepesites'], true) ? 'lejárat' : 'határidő';

        return [
            'title' => "{$label} {$when}",
            'body' => "{$this->title} — {$dateLabel}: {$this->dueOn}",
            'url' => $this->url,
            'dedupe' => $this->dedupeKey,
        ];
    }
}
