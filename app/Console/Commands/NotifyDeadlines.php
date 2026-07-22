<?php

namespace App\Console\Commands;

use App\Models\ProjectPhase;
use App\Models\Task;
use App\Models\User;
use App\Notifications\DeadlineApproaching;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Közelgő és lejárt határidők értesítése (feladatok + ütemterv-fázisok).
 *
 * Naponta fut. Minden tételhez tételenként+határidőnként+állapotonként egyszer
 * küld értesítést (a data.dedupe kulccsal védve a duplikáció ellen), így nem
 * spamel: egy „közeleg" és egy „lejárt" jelzés érkezik érintettenként.
 */
class NotifyDeadlines extends Command
{
    protected $signature = 'notifications:deadlines {--days=3 : Ennyi napon belüli határidők számítanak közelgőnek}';

    protected $description = 'Értesítés közelgő és lejárt határidőkről (feladatok, ütemezés)';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $horizon = today()->addDays($days);

        // A már kiküldött értesítések dedupe-kulcsai (duplikáció-védelem).
        $sent = DB::table('notifications')
            ->where('type', DeadlineApproaching::class)
            ->pluck('data')
            ->map(fn ($d) => json_decode($d, true)['dedupe'] ?? null)
            ->filter()
            ->flip();

        $count = 0;

        // --- Feladatok ---
        $tasks = Task::query()
            ->where('status', '!=', 'kesz')
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<=', $horizon)
            ->with('assignees')
            ->get();

        foreach ($tasks as $task) {
            $overdue = $task->isOverdue();
            $key = "task-{$task->id}-{$task->due_on->toDateString()}-".($overdue ? 'over' : 'soon');
            if ($sent->has($key)) {
                continue;
            }
            $recipients = $task->assignees->where('is_active', true);
            if ($recipients->isEmpty()) {
                continue;
            }
            Notification::send($recipients, new DeadlineApproaching(
                'feladat', $task->title, $task->due_on->toDateString(), $overdue, '/tasks', $key,
            ));
            $count += $recipients->count();
        }

        // --- Ütemterv-fázisok ---
        $phases = ProjectPhase::query()
            ->where('progress', '<', 100)
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<=', $horizon)
            ->with('project.projectManager')
            ->get();

        // A fázisokról a projektvezető és minden projekt-kezelő jogú admin értesül.
        $managers = User::where('is_active', true)->where('is_external', false)
            ->permission('projects.edit')->get();

        foreach ($phases as $phase) {
            $overdue = $phase->isOverdue();
            $key = "phase-{$phase->id}-{$phase->due_on->toDateString()}-".($overdue ? 'over' : 'soon');
            if ($sent->has($key)) {
                continue;
            }
            $pm = $phase->project?->projectManager;
            $recipients = $managers
                ->when($pm, fn ($c) => $c->push($pm))
                ->unique('id')
                ->where('is_active', true);
            if ($recipients->isEmpty()) {
                continue;
            }
            $title = trim(($phase->project?->name ? $phase->project->name.' – ' : '').$phase->name);
            $url = $phase->project ? "/projects/{$phase->project->id}" : '/projects';
            Notification::send($recipients, new DeadlineApproaching(
                'fazis', $title, $phase->due_on->toDateString(), $overdue, $url, $key,
            ));
            $count += $recipients->count();
        }

        $this->info("Kiküldött határidő-értesítések: {$count}.");

        return self::SUCCESS;
    }
}
