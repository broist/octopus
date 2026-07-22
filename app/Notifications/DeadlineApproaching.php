<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Felületi (harang) értesítés közelgő vagy lejárt határidőről
 * (feladat, ütemterv-fázis, alvállalkozói/munkatársi dokumentum).
 *
 * A FELADAT-határidőkről a felelős(ök) e-mailt is kapnak a rendszerben tárolt
 * címükre (megrendelői kérés) — a többi típus csak harang-értesítés.
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
        // A feladat-határidőkről a felelős e-mailt is kap; a többi típus csak
        // felületi (harang) értesítés.
        return $this->kind === 'feladat'
            ? ['database', 'mail']
            : ['database'];
    }

    /**
     * A felelősnek küldött e-mail a közelgő/lejárt feladat-határidőről.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $name = $notifiable->name ?? '';
        $mail = (new MailMessage)
            ->subject(($this->overdue ? 'Lejárt feladat-határidő: ' : 'Közelgő feladat-határidő: ').$this->title)
            ->greeting($name !== '' ? "Kedves {$name}!" : 'Kedves Munkatárs!');

        if ($this->overdue) {
            $mail->line('Egy Önhöz rendelt feladat határideje **lejárt**, és a feladat még nincs kész:');
        } else {
            $mail->line('Egy Önhöz rendelt feladatnak **közeleg a határideje**:');
        }

        return $mail
            ->line("**{$this->title}**")
            ->line("Határidő: {$this->dueOn}")
            ->action('Feladat megnyitása', url($this->url))
            ->line('Kérjük, nézzen rá és szükség esetén frissítse a feladat állapotát.')
            ->salutation('Üdvözlettel: Octopus');
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
