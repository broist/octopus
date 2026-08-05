<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\TaskComment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Értesítés arról, hogy valaki hozzászólt egy feladathoz — a feladat
 * felelőseinek (és a létrehozójának), a hozzászólót kihagyva.
 *
 * Harang- és e-mail értesítés is megy róla. Sorba tesszük (ShouldQueue), hogy
 * a hozzászólás küldése ne várjon az SMTP-re.
 */
class TaskCommented extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Task $task,
        public TaskComment $comment,
        public string $authorName,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        // E-mail csak akkor, ha van hova küldeni.
        return filled($notifiable->email ?? null)
            ? ['database', 'mail']
            : ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => 'Új hozzászólás a feladatodhoz',
            'body' => "{$this->task->title} — {$this->authorName}: ".$this->excerpt(120),
            'url' => $this->taskPath(),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = $notifiable->name ?? '';
        $due = $this->task->due_on?->format('Y-m-d');

        $mail = (new MailMessage)
            ->subject("Új hozzászólás: {$this->task->title}")
            ->greeting($name !== '' ? "Kedves {$name}!" : 'Kedves Munkatárs!')
            ->line("**{$this->authorName}** hozzászólt egy feladathoz, amelynek felelőse vagy. Kérjük, nézz rá:")
            ->line("**Feladat:** {$this->task->title}");

        if ($this->task->project) {
            $mail->line("**Projekt:** {$this->task->project->code} – {$this->task->project->name}");
        }

        if ($due !== null) {
            $mail->line("**Határidő:** {$due}");
        }

        return $mail
            ->line('---')
            ->line($this->excerpt(1000))
            ->action('Feladat megnyitása', url($this->taskPath()))
            ->salutation('Üdvözlettel: Octopus');
    }

    /** A hozzászólás rövidített szövege. */
    private function excerpt(int $limit): string
    {
        return Str::limit(trim((string) $this->comment->body), $limit);
    }

    /**
     * Mélylink a feladatra. A `hidden=` üresen tartja az állapotszűrőt, hogy a
     * már lezárt feladat is látszódjon; a `task` paraméterre a lista
     * automatikusan megnyitja a feladat ablakát.
     */
    private function taskPath(): string
    {
        return '/tasks?hidden=&task='.$this->task->id;
    }
}
