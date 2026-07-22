<?php

namespace App\Console\Commands;

use App\Models\ProjectPhase;
use App\Models\StaffQualification;
use App\Models\SubcontractorCertification;
use App\Models\Task;
use App\Models\User;
use App\Notifications\DeadlineApproaching;
use App\Notifications\TaskDeadlineDigest;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Közelgő és lejárt határidők értesítése (feladatok + ütemterv-fázisok).
 *
 * Naponta fut. A HARANG-értesítés tételenként+állapotonként egyszer szól (dedupe).
 * A FELADATOKRÓL a felelős(ök) ezen felül NAPI, tömbösített e-mailt is kapnak:
 * felhasználónként EGY levél az összes nyitott (nem kész), közelgő/lejárt
 * határidejű feladatukkal — minden nap, amíg készre nem állítják (cache-őr, hogy
 * naponta csak egyszer menjen).
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
        $emailCount = 0;

        // --- Feladatok ---
        $tasks = Task::query()
            ->where('status', '!=', 'kesz')
            ->whereNotNull('due_on')
            ->whereDate('due_on', '<=', $horizon)
            ->with('assignees')
            ->get();

        // 1) Harang-értesítés: tételenként+állapotonként egyszer (dedupe).
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

        // 2) Napi tömbösített e-mail: felhasználónként EGY levél az összes
        //    nyitott, közelgő/lejárt feladatával. Naponta egyszer (cache-őr).
        $today = today()->toDateString();
        $digests = [];
        foreach ($tasks as $task) {
            $overdue = $task->isOverdue();
            foreach ($task->assignees->where('is_active', true)->where('is_external', false) as $assignee) {
                $digests[$assignee->id]['user'] ??= $assignee;
                $digests[$assignee->id]['tasks'][] = [
                    'title' => $task->title,
                    'due_on' => $task->due_on->toDateString(),
                    'overdue' => $overdue,
                ];
            }
        }

        foreach ($digests as $uid => $digest) {
            $cacheKey = "task-digest-{$uid}-{$today}";
            if (Cache::has($cacheKey)) {
                continue; // ma már kapott emlékeztetőt
            }
            $digest['user']->notify(new TaskDeadlineDigest($digest['tasks']));
            Cache::put($cacheKey, true, now()->addDay());
            $emailCount++;
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

        // --- Alvállalkozói dokumentumok (biztosítás, engedély, tanúsítvány) ---
        // Hosszabb, 30 napos előrejelzés — a megújítás átfutási ideje miatt.
        $certHorizon = today()->addDays(30);
        $certRecipients = User::where('is_active', true)->where('is_external', false)
            ->permission('subcontractors.edit')->get();

        if ($certRecipients->isNotEmpty()) {
            $certs = SubcontractorCertification::query()
                ->whereNotNull('valid_until')
                ->whereDate('valid_until', '<=', $certHorizon)
                ->whereHas('partner', fn ($q) => $q->where('is_subcontractor', true))
                ->with('partner:id,name')
                ->get();

            foreach ($certs as $cert) {
                if (! $cert->partner) {
                    continue;
                }
                $overdue = $cert->valid_until->isPast();
                $key = "cert-{$cert->id}-{$cert->valid_until->toDateString()}-".($overdue ? 'over' : 'soon');
                if ($sent->has($key)) {
                    continue;
                }
                $title = "{$cert->partner->name} – {$cert->name}";
                Notification::send($certRecipients, new DeadlineApproaching(
                    'tanusitvany', $title, $cert->valid_until->toDateString(), $overdue,
                    "/subcontractors/{$cert->partner->id}", $key,
                ));
                $count += $certRecipients->count();
            }
        }

        // --- Munkatársi végzettségek / jogosultságok (30 napos előrejelzés) ---
        $qualRecipients = User::where('is_active', true)->where('is_external', false)
            ->permission('staff.edit')->get();

        if ($qualRecipients->isNotEmpty()) {
            $quals = StaffQualification::query()
                ->whereNotNull('valid_until')
                ->whereDate('valid_until', '<=', $certHorizon)
                ->whereHas('user', fn ($q) => $q->where('is_external', false))
                ->with('user:id,name')
                ->get();

            foreach ($quals as $qual) {
                if (! $qual->user) {
                    continue;
                }
                $overdue = $qual->valid_until->isPast();
                $key = "qual-{$qual->id}-{$qual->valid_until->toDateString()}-".($overdue ? 'over' : 'soon');
                if ($sent->has($key)) {
                    continue;
                }
                $title = "{$qual->user->name} – {$qual->name}";
                Notification::send($qualRecipients, new DeadlineApproaching(
                    'kepesites', $title, $qual->valid_until->toDateString(), $overdue,
                    "/staff/{$qual->user->id}", $key,
                ));
                $count += $qualRecipients->count();
            }
        }

        $this->info("Kiküldött harang-értesítések: {$count}. Napi feladat-emlékeztető e-mailek: {$emailCount}.");

        return self::SUCCESS;
    }
}
