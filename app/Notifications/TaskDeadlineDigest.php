<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Napi, tömbösített e-mail a felelősnek a nyitott (nem kész), közelgő vagy
 * lejárt határidejű feladatairól — EGY levélben az összes érintett feladat.
 *
 * Naponta megy ki (a notifications:deadlines parancsból), amíg a felhasználónak
 * van ilyen feladata; amint egy feladat készre vált, kikerül a levélből.
 *
 * @param  array<int, array{title:string, due_on:string, overdue:bool}>  $tasks
 */
class TaskDeadlineDigest extends Notification
{
    use Queueable;

    /**
     * @param  array<int, array{title:string, due_on:string, overdue:bool}>  $tasks
     */
    public function __construct(public array $tasks)
    {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        // Rendezés: a lejártak elöl, azon belül a legközelebbi határidő.
        $sorted = collect($this->tasks)
            ->sort(function ($a, $b) {
                if ($a['overdue'] !== $b['overdue']) {
                    return $a['overdue'] ? -1 : 1;
                }

                return strcmp($a['due_on'], $b['due_on']);
            })
            ->values();

        $count = $sorted->count();
        $overdueCount = $sorted->where('overdue', true)->count();
        $name = $notifiable->name ?? '';

        $mail = (new MailMessage)
            ->subject("Feladat-emlékeztető: {$count} nyitott teendő"
                .($overdueCount > 0 ? " ({$overdueCount} lejárt)" : ''))
            ->greeting($name !== '' ? "Kedves {$name}!" : 'Kedves Munkatárs!')
            ->line('Az alábbi, hozzád rendelt feladatoknak közeleg vagy lejárt a határideje, és még nincsenek készen. Kérjük, nézz rájuk:');

        foreach ($sorted as $t) {
            $flag = $t['overdue'] ? '⚠️ LEJÁRT' : 'közeleg';
            $mail->line("• **{$t['title']}** — határidő: {$t['due_on']} ({$flag})");
        }

        return $mail
            ->action('Feladatok megnyitása', url('/tasks'))
            ->line('Amint egy feladatot készre állítasz, arról nem kapsz több emlékeztetőt.')
            ->salutation('Üdvözlettel: Octopus');
    }
}
