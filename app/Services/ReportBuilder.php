<?php

namespace App\Services;

use App\Models\Defect;
use App\Models\Inspection;
use App\Models\Machine;
use App\Models\MachineBooking;
use App\Models\MaterialProcurement;
use App\Models\Partner;
use App\Models\Project;
use App\Models\ProjectBudgetItem;
use App\Models\ProjectCost;
use App\Models\ProjectPhase;
use App\Models\Quote;
use App\Models\SafetyRecord;
use App\Models\StaffAbsence;
use App\Models\SubcontractorCertification;
use App\Models\SubcontractorRating;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkLog;
use App\Support\Finance;
use App\Support\Machines;
use App\Support\Qa;
use App\Support\Reports;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * A Riportok / Statisztikák modul (spec §15) számítási motorja.
 *
 * Minden riport UGYANOLYAN normalizált szerkezetet ad vissza (összesítő
 * csempék + oszlopdefiníciók + sorok + összesen-sor + opcionális diagram),
 * így a képernyő, a CSV- és a PDF-export ugyanabból az adatból dolgozik.
 *
 * A riportok kizárólag olvasnak; minden adat a többi modulból jön.
 */
class ReportBuilder
{
    private ?CarbonImmutable $from;

    private ?CarbonImmutable $to;

    private ?int $projectFilter;

    private ?string $statusFilter;

    private string $group;

    /** @var array<int, int>|null A szűrésnek megfelelő projekt-id-k (fő + al). */
    private ?array $scopeIds = null;

    /**
     * @param  array<string, mixed>  $filters
     */
    private function __construct(private string $key, array $filters)
    {
        [$this->from, $this->to] = Reports::range(
            (string) ($filters['period'] ?? 'minden'),
            $filters['from'] ?? null,
            $filters['to'] ?? null,
        );

        $this->projectFilter = isset($filters['project']) && $filters['project'] !== '' && $filters['project'] !== null
            ? (int) $filters['project']
            : null;
        $this->statusFilter = ($filters['status'] ?? '') !== '' ? (string) $filters['status'] : null;

        $definition = Reports::definition($key);
        $group = (string) ($filters['group'] ?? '');
        $this->group = array_key_exists($group, $definition['groups'])
            ? $group
            : (string) ($definition['default_group'] ?? '');
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public static function build(string $key, array $filters): array
    {
        $builder = new self($key, $filters);
        $definition = Reports::definition($key);

        $report = match ($key) {
            'nyeresegesseg' => $builder->profitability(),
            'csuszas' => $builder->slippage(),
            'koltseg' => $builder->costAnalysis(),
            'eroforras' => $builder->resourceUsage(),
            'alvallalkozo' => $builder->subcontractorStats(),
            'kifizetes' => $builder->payables(),
            'minoseg' => $builder->quality(),
            'idoszaki' => $builder->periodic(),
        };

        return [
            'key' => $key,
            'title' => $definition['title'],
            'subtitle' => $definition['subtitle'],
            'group' => $builder->group,
            'range' => [
                'from' => $builder->from?->toDateString(),
                'to' => $builder->to?->toDateString(),
            ],
            'summary' => [],
            'columns' => [],
            'rows' => [],
            'totals' => null,
            'chart' => null,
            'note' => null,
            ...$report,
        ];
    }

    /* ================================================================== */
    /* 1) Projekt-nyereségesség */
    /* ================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function profitability(): array
    {
        // Az időszak itt a PROJEKTEKET szűri (az időszakban aktív munkák);
        // az összegek a projekt teljes élettartamára vonatkoznak.
        $projects = $this->mainProjects()
            ->when($this->from, fn ($q) => $q->where(fn ($w) => $w
                ->whereNull('ends_on')->orWhereDate('ends_on', '>=', $this->from->toDateString())))
            ->when($this->to, fn ($q) => $q->where(fn ($w) => $w
                ->whereNull('starts_on')->orWhereDate('starts_on', '<=', $this->to->toDateString())))
            ->get();

        $idsFor = [];
        $allIds = [];
        foreach ($projects as $project) {
            $ids = array_merge([$project->id], $project->subprojects->pluck('id')->all());
            $idsFor[$project->id] = $ids;
            $allIds = array_merge($allIds, $ids);
        }

        $material = $this->sumBy(MaterialProcurement::committed()->whereIn('project_id', $allIds),
            'project_id', 'quantity * unit_price');
        $costByCategory = $this->costsByProjectAndCategory($allIds);
        $quote = $allIds === [] ? [] : Quote::whereIn('project_id', $allIds)->where('status', 'jóváhagyva')
            ->selectRaw('project_id, max(net_offer) as v')->groupBy('project_id')
            ->pluck('v', 'project_id')->map(fn ($v) => (float) $v)->all();

        $rows = [];
        foreach ($projects as $project) {
            $ids = $idsFor[$project->id];

            $mat = $this->pick($material, $ids);
            $sub = $this->pickCategory($costByCategory, $ids, 'alvallalkozo');
            $machine = $this->pickCategory($costByCategory, $ids, 'gep');
            $other = $this->pickCategory($costByCategory, $ids, 'egyeb');
            $totalCost = $mat + $sub + $machine + $other;

            $revenue = $project->contract_value !== null
                ? (float) $project->contract_value
                : $this->max($quote, $ids);
            $profit = $revenue - $totalCost;

            $rows[] = [
                'code' => $project->code,
                'name' => $project->name,
                'client' => $project->client?->name ?? '—',
                'status' => Project::STATUSES[$project->status] ?? $project->status,
                'revenue' => $revenue,
                'material' => $mat,
                'subcontractor' => $sub,
                'machine' => $machine,
                'other' => $other,
                'cost' => $totalCost,
                'profit' => $profit,
                'margin' => $revenue > 0 ? round($profit / $revenue * 100, 1) : null,
                '_link' => route('finance.show', $project->id),
                '_tone' => $profit < 0 ? 'bad' : null,
            ];
        }

        $revenueTotal = array_sum(array_column($rows, 'revenue'));
        $costTotal = array_sum(array_column($rows, 'cost'));
        $profitTotal = $revenueTotal - $costTotal;

        $top = collect($rows)->sortByDesc(fn ($r) => abs($r['profit']))->take(10)->values();

        return [
            'summary' => [
                $this->card('Bevétel', $revenueTotal, 'huf'),
                $this->card('Költség', $costTotal, 'huf'),
                $this->card('Eredmény', $profitTotal, 'huf', $profitTotal < 0 ? 'bad' : 'good'),
                $this->card('Átlagos árrés', $revenueTotal > 0 ? round($profitTotal / $revenueTotal * 100, 1) : null, 'pct'),
            ],
            'columns' => [
                $this->col('code', 'Kód', 'text'),
                $this->col('name', 'Projekt', 'text'),
                $this->col('client', 'Megrendelő', 'text'),
                $this->col('status', 'Státusz', 'text'),
                $this->col('revenue', 'Bevétel', 'huf'),
                $this->col('material', 'Anyag', 'huf'),
                $this->col('subcontractor', 'Alvállalkozó', 'huf'),
                $this->col('machine', 'Gép', 'huf'),
                $this->col('other', 'Egyéb', 'huf'),
                $this->col('cost', 'Költség össz.', 'huf'),
                $this->col('profit', 'Eredmény', 'huf'),
                $this->col('margin', 'Árrés', 'pct'),
            ],
            'rows' => $rows,
            'totals' => [
                'code' => '',
                'name' => 'Összesen',
                'client' => '',
                'status' => '',
                'revenue' => $revenueTotal,
                'material' => array_sum(array_column($rows, 'material')),
                'subcontractor' => array_sum(array_column($rows, 'subcontractor')),
                'machine' => array_sum(array_column($rows, 'machine')),
                'other' => array_sum(array_column($rows, 'other')),
                'cost' => $costTotal,
                'profit' => $profitTotal,
                'margin' => $revenueTotal > 0 ? round($profitTotal / $revenueTotal * 100, 1) : null,
            ],
            'chart' => $rows === [] ? null : [
                'title' => 'Eredmény projektenként (10 legnagyobb tétel)',
                'labels' => $top->pluck('code')->all(),
                'series' => [[
                    'label' => 'Eredmény',
                    'format' => 'huf',
                    'values' => $top->pluck('profit')->map(fn ($v) => (float) $v)->all(),
                ]],
            ],
            'note' => 'A bevétel a szerződéses nettó érték; ahol nincs megadva, ott a jóváhagyott árajánlat összege. '
                .'Az anyagköltség a megrendelt/beérkezett beszerzésekből jön automatikusan. '
                .'Az időszak-szűrő a projekteket válogatja (az időszakban aktív munkák), az összegek a teljes projektre vonatkoznak.',
        ];
    }

    /* ================================================================== */
    /* 2) Csúszás-elemzés */
    /* ================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function slippage(): array
    {
        return match ($this->group) {
            'projekt' => $this->slippageByProject(),
            'feladat' => $this->slippageByTask(),
            default => $this->slippageByPhase(),
        };
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function phaseRows(): Collection
    {
        $today = CarbonImmutable::today();

        return ProjectPhase::query()
            ->work()
            ->whereIn('project_id', $this->scopeIds())
            ->whereNotNull('due_on')
            ->when($this->from, fn ($q) => $q->whereDate('due_on', '>=', $this->from->toDateString()))
            ->when($this->to, fn ($q) => $q->whereDate('due_on', '<=', $this->to->toDateString()))
            ->with('project:id,code,name,parent_id')
            ->orderBy('due_on')
            ->get()
            ->map(function (ProjectPhase $phase) use ($today) {
                $due = CarbonImmutable::parse($phase->due_on);
                $done = $phase->completed_on ? CarbonImmutable::parse($phase->completed_on) : null;

                if ($done) {
                    $slip = $due->diffInDays($done, false);
                    $state = $slip > 0 ? 'Késve zárva' : 'Időben zárva';
                } elseif ($due->lt($today)) {
                    $slip = $due->diffInDays($today, false);
                    $state = 'Lejárt, nyitott';
                } else {
                    $slip = null;
                    $state = 'Folyamatban';
                }

                return [
                    'project_id' => $phase->project_id,
                    'code' => $phase->project?->code ?? '—',
                    'name' => $phase->name,
                    'due_on' => $due->toDateString(),
                    'completed_on' => $done?->toDateString(),
                    'progress' => $phase->progress,
                    'slip' => $slip,
                    'state' => $state,
                    'closed' => $done !== null,
                ];
            });
    }

    /**
     * @return array<string, mixed>
     */
    private function slippageByPhase(): array
    {
        $phases = $this->phaseRows();

        $rows = $phases->map(fn ($r) => [
            'code' => $r['code'],
            'name' => $r['name'],
            'due_on' => $r['due_on'],
            'completed_on' => $r['completed_on'] ?? '—',
            'progress' => $r['progress'],
            'slip' => $r['slip'],
            'state' => $r['state'],
            '_link' => route('projects.show', $r['project_id']),
            '_tone' => ($r['slip'] ?? 0) > 0 ? 'bad' : null,
        ])->all();

        return [
            'summary' => $this->slippageSummary($phases, 'fázis'),
            'columns' => [
                $this->col('code', 'Projekt', 'text'),
                $this->col('name', 'Fázis', 'text'),
                $this->col('due_on', 'Tervezett határidő', 'date'),
                $this->col('completed_on', 'Tényleges befejezés', 'date'),
                $this->col('progress', 'Készültség', 'pct'),
                $this->col('slip', 'Csúszás', 'days'),
                $this->col('state', 'Állapot', 'text'),
            ],
            'rows' => $rows,
            'note' => $this->slippageNote(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function slippageByProject(): array
    {
        $phases = $this->phaseRows();

        $rows = $phases->groupBy('code')->map(function (Collection $group) {
            $slipping = $group->filter(fn ($r) => ($r['slip'] ?? 0) > 0);
            $closed = $group->where('closed', true);

            return [
                'code' => $group->first()['code'],
                'phases' => $group->count(),
                'closed' => $closed->count(),
                'late' => $slipping->count(),
                'on_time_pct' => $closed->count() > 0
                    ? round($closed->filter(fn ($r) => ($r['slip'] ?? 0) <= 0)->count() / $closed->count() * 100, 1)
                    : null,
                'avg_slip' => $slipping->count() > 0 ? round($slipping->avg('slip'), 1) : null,
                'max_slip' => $slipping->count() > 0 ? (int) $slipping->max('slip') : null,
                '_link' => route('projects.show', $group->first()['project_id']),
                '_tone' => $slipping->count() > 0 ? 'bad' : null,
            ];
        })->sortByDesc('max_slip')->values()->all();

        $top = collect($rows)->filter(fn ($r) => $r['max_slip'] !== null)->take(10)->values();

        return [
            'summary' => $this->slippageSummary($phases, 'fázis'),
            'columns' => [
                $this->col('code', 'Projekt', 'text'),
                $this->col('phases', 'Fázisok', 'num'),
                $this->col('closed', 'Lezárt', 'num'),
                $this->col('late', 'Csúszó', 'num'),
                $this->col('on_time_pct', 'Időben zárt', 'pct'),
                $this->col('avg_slip', 'Átlagos csúszás', 'days'),
                $this->col('max_slip', 'Legnagyobb csúszás', 'days'),
            ],
            'rows' => $rows,
            'chart' => $top->isEmpty() ? null : [
                'title' => 'Legnagyobb csúszás projektenként (nap)',
                'labels' => $top->pluck('code')->all(),
                'series' => [[
                    'label' => 'Csúszás (nap)',
                    'format' => 'days',
                    'values' => $top->pluck('max_slip')->map(fn ($v) => (float) $v)->all(),
                ]],
            ],
            'note' => $this->slippageNote(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function slippageByTask(): array
    {
        $today = CarbonImmutable::today();

        $tasks = Task::query()
            ->whereNotNull('due_on')
            ->when($this->projectFilter || $this->statusFilter, fn ($q) => $q->whereIn('project_id', $this->scopeIds()))
            ->when($this->from, fn ($q) => $q->whereDate('due_on', '>=', $this->from->toDateString()))
            ->when($this->to, fn ($q) => $q->whereDate('due_on', '<=', $this->to->toDateString()))
            ->with(['project:id,code', 'assignees:id,name'])
            ->orderBy('due_on')
            ->get()
            ->map(function (Task $task) use ($today) {
                $due = CarbonImmutable::parse($task->due_on);
                $done = $task->completed_at ? CarbonImmutable::parse($task->completed_at)->startOfDay() : null;

                if ($task->status === 'kesz' && $done) {
                    $slip = $due->diffInDays($done, false);
                    $state = $slip > 0 ? 'Késve teljesítve' : 'Időben teljesítve';
                } elseif ($task->status === 'kesz') {
                    $slip = null;
                    $state = 'Kész (nincs dátum)';
                } elseif ($due->lt($today)) {
                    $slip = $due->diffInDays($today, false);
                    $state = 'Lejárt, nyitott';
                } else {
                    $slip = null;
                    $state = 'Folyamatban';
                }

                return [
                    'code' => $task->project?->code ?? '—',
                    'name' => $task->title,
                    'assignees' => $task->assignees->pluck('name')->implode(', ') ?: '—',
                    'due_on' => $due->toDateString(),
                    'completed_on' => $done?->toDateString() ?? '—',
                    'slip' => $slip,
                    'state' => $state,
                    'closed' => $task->status === 'kesz' && $done !== null,
                    '_link' => route('tasks.index'),
                    '_tone' => ($slip ?? 0) > 0 ? 'bad' : null,
                ];
            });

        return [
            'summary' => $this->slippageSummary($tasks, 'feladat'),
            'columns' => [
                $this->col('code', 'Projekt', 'text'),
                $this->col('name', 'Feladat', 'text'),
                $this->col('assignees', 'Felelős', 'text'),
                $this->col('due_on', 'Határidő', 'date'),
                $this->col('completed_on', 'Teljesítve', 'date'),
                $this->col('slip', 'Csúszás', 'days'),
                $this->col('state', 'Állapot', 'text'),
            ],
            'rows' => $tasks->all(),
            'note' => 'A feladat teljesítésének napja a „Kész" állapotba állítás időpontja.',
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    private function slippageSummary(Collection $items, string $unit): array
    {
        $slipping = $items->filter(fn ($r) => ($r['slip'] ?? 0) > 0);
        $closed = $items->where('closed', true);
        $onTime = $closed->filter(fn ($r) => ($r['slip'] ?? 0) <= 0);

        return [
            $this->card('Vizsgált '.$unit, $items->count(), 'num'),
            $this->card('Csúszó tétel', $slipping->count(), 'num', $slipping->count() > 0 ? 'bad' : 'good'),
            $this->card('Időben teljesült', $closed->count() > 0 ? round($onTime->count() / $closed->count() * 100, 1) : null, 'pct'),
            $this->card('Átlagos csúszás', $slipping->count() > 0 ? round($slipping->avg('slip'), 1) : null, 'days'),
        ];
    }

    private function slippageNote(): string
    {
        return 'A tényleges befejezés a fázis 100%-ra állításának napja. A még nyitott, lejárt határidejű '
            .'fázisoknál a csúszás a mai napig eltelt idő. Az időszak-szűrő a tervezett határidőre vonatkozik.';
    }

    /* ================================================================== */
    /* 3) Költség-elemzés (terv vs. tény) */
    /* ================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function costAnalysis(): array
    {
        return $this->group === 'kategoria' ? $this->costsByCategory() : $this->costsByProject();
    }

    /**
     * @return array<string, mixed>
     */
    private function costsByProject(): array
    {
        $projects = $this->mainProjects()->get();

        $idsFor = [];
        $allIds = [];
        foreach ($projects as $project) {
            $ids = array_merge([$project->id], $project->subprojects->pluck('id')->all());
            $idsFor[$project->id] = $ids;
            $allIds = array_merge($allIds, $ids);
        }

        $budget = $this->sumBy(ProjectBudgetItem::whereIn('project_id', $allIds), 'project_id', 'amount');
        $material = $this->sumBy($this->materialQuery($allIds), 'project_id', 'quantity * unit_price');
        $costs = $this->sumBy($this->costQuery($allIds), 'project_id', 'amount');

        $rows = [];
        foreach ($projects as $project) {
            $ids = $idsFor[$project->id];
            $planned = $this->pick($budget, $ids);
            $actual = $this->pick($material, $ids) + $this->pick($costs, $ids);

            if ($planned == 0.0 && $actual == 0.0) {
                continue;
            }

            $rows[] = [
                'code' => $project->code,
                'name' => $project->name,
                'status' => Project::STATUSES[$project->status] ?? $project->status,
                'planned' => $planned,
                'actual' => $actual,
                'diff' => $actual - $planned,
                'usage' => $planned > 0 ? round($actual / $planned * 100, 1) : null,
                '_link' => route('finance.show', $project->id),
                '_tone' => $planned > 0 && $actual > $planned ? 'bad' : null,
            ];
        }

        $plannedTotal = array_sum(array_column($rows, 'planned'));
        $actualTotal = array_sum(array_column($rows, 'actual'));
        $over = collect($rows)->where('_tone', 'bad');

        return [
            'summary' => [
                $this->card('Tervezett költség', $plannedTotal, 'huf'),
                $this->card('Tényleges költség', $actualTotal, 'huf'),
                $this->card('Eltérés', $actualTotal - $plannedTotal, 'huf', $actualTotal > $plannedTotal ? 'bad' : 'good'),
                $this->card('Keretet túllépő projekt', $over->count(), 'num', $over->count() > 0 ? 'bad' : 'good'),
            ],
            'columns' => [
                $this->col('code', 'Kód', 'text'),
                $this->col('name', 'Projekt', 'text'),
                $this->col('status', 'Státusz', 'text'),
                $this->col('planned', 'Terv', 'huf'),
                $this->col('actual', 'Tény', 'huf'),
                $this->col('diff', 'Eltérés', 'huf'),
                $this->col('usage', 'Keret felhasználva', 'pct'),
            ],
            'rows' => $rows,
            'totals' => [
                'code' => '',
                'name' => 'Összesen',
                'status' => '',
                'planned' => $plannedTotal,
                'actual' => $actualTotal,
                'diff' => $actualTotal - $plannedTotal,
                'usage' => $plannedTotal > 0 ? round($actualTotal / $plannedTotal * 100, 1) : null,
            ],
            'note' => $this->costNote(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function costsByCategory(): array
    {
        $ids = $this->scopeIds();

        $budget = $ids === [] ? [] : ProjectBudgetItem::whereIn('project_id', $ids)
            ->selectRaw('category, sum(amount) as v')->groupBy('category')
            ->pluck('v', 'category')->map(fn ($v) => (float) $v)->all();

        $costs = $ids === [] ? [] : $this->costQuery($ids)
            ->selectRaw('category, sum(amount) as v')->groupBy('category')
            ->pluck('v', 'category')->map(fn ($v) => (float) $v)->all();

        $costs['anyag'] = $ids === [] ? 0.0 : (float) $this->materialQuery($ids)->sum(DB::raw('quantity * unit_price'));

        $rows = [];
        foreach (Finance::BUDGET_CATEGORIES as $key => $label) {
            $planned = (float) ($budget[$key] ?? 0);
            $actual = (float) ($costs[$key] ?? 0);

            $rows[] = [
                'category' => $label,
                'planned' => $planned,
                'actual' => $actual,
                'diff' => $actual - $planned,
                'usage' => $planned > 0 ? round($actual / $planned * 100, 1) : null,
                '_tone' => $planned > 0 && $actual > $planned ? 'bad' : null,
            ];
        }

        $plannedTotal = array_sum(array_column($rows, 'planned'));
        $actualTotal = array_sum(array_column($rows, 'actual'));

        return [
            'summary' => [
                $this->card('Tervezett költség', $plannedTotal, 'huf'),
                $this->card('Tényleges költség', $actualTotal, 'huf'),
                $this->card('Eltérés', $actualTotal - $plannedTotal, 'huf', $actualTotal > $plannedTotal ? 'bad' : 'good'),
                $this->card('Keret felhasználva', $plannedTotal > 0 ? round($actualTotal / $plannedTotal * 100, 1) : null, 'pct'),
            ],
            'columns' => [
                $this->col('category', 'Kategória', 'text'),
                $this->col('planned', 'Terv', 'huf'),
                $this->col('actual', 'Tény', 'huf'),
                $this->col('diff', 'Eltérés', 'huf'),
                $this->col('usage', 'Keret felhasználva', 'pct'),
            ],
            'rows' => $rows,
            'totals' => [
                'category' => 'Összesen',
                'planned' => $plannedTotal,
                'actual' => $actualTotal,
                'diff' => $actualTotal - $plannedTotal,
                'usage' => $plannedTotal > 0 ? round($actualTotal / $plannedTotal * 100, 1) : null,
            ],
            'chart' => [
                'title' => 'Terv vs. tény kategóriánként',
                'labels' => array_column($rows, 'category'),
                'series' => [
                    ['label' => 'Terv', 'format' => 'huf', 'values' => array_map('floatval', array_column($rows, 'planned'))],
                    ['label' => 'Tény', 'format' => 'huf', 'values' => array_map('floatval', array_column($rows, 'actual'))],
                ],
            ],
            'note' => $this->costNote(),
        ];
    }

    private function costNote(): string
    {
        return 'Az anyagköltség a megrendelt/beérkezett beszerzésekből számolódik, a munkadíj tényleges költsége '
            .'(bérköltség) a rendszerben nem szerepel. A tervezett költségvetés nincs időszakra bontva — '
            .'az időszak-szűrő csak a tényleges költségeket szűri.';
    }

    /* ================================================================== */
    /* 4) Erőforrás-kihasználtság */
    /* ================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function resourceUsage(): array
    {
        return $this->group === 'gepek' ? $this->machineUsage() : $this->staffUsage();
    }

    /**
     * @return array<string, mixed>
     */
    private function staffUsage(): array
    {
        [$from, $to] = $this->rangeOrCurrentYear();
        $workdays = WorkdayCalendar::workdaysBetween($from, $to);
        $scoped = $this->projectFilter !== null;

        $users = User::query()
            ->where('is_external', false)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'job_title']);

        $logs = WorkLog::query()
            ->whereBetween('work_date', [$from->toDateString(), $to->toDateString()])
            ->when($scoped, fn ($q) => $q->whereIn('project_id', $this->scopeIds()))
            ->selectRaw('user_id, sum(hours) as h, count(distinct project_id) as p, count(distinct work_date) as d')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $absences = StaffAbsence::overlapping($from->toDateString(), $to->toDateString())
            ->get()
            ->groupBy('user_id');

        $rows = [];
        foreach ($users as $user) {
            $log = $logs->get($user->id);
            $hours = $log ? (float) $log->h : 0.0;

            $absenceDays = 0;
            foreach ($absences->get($user->id, collect()) as $absence) {
                $absenceDays += WorkdayCalendar::workdaysBetween(
                    CarbonImmutable::parse(max($absence->starts_on->toDateString(), $from->toDateString())),
                    CarbonImmutable::parse(min($absence->ends_on->toDateString(), $to->toDateString())),
                );
            }

            $capacity = max(($workdays - $absenceDays) * 8, 0);

            $rows[] = [
                'name' => $user->name,
                'job_title' => $user->job_title ?: '—',
                'hours' => round($hours, 1),
                'days' => $log ? (int) $log->d : 0,
                'absence_days' => $absenceDays,
                'capacity' => $capacity,
                'usage' => $capacity > 0 ? round($hours / $capacity * 100, 1) : null,
                'projects' => $log ? (int) $log->p : 0,
                '_link' => route('staff.show', $user->id),
            ];
        }

        $hoursTotal = array_sum(array_column($rows, 'hours'));
        $capacityTotal = array_sum(array_column($rows, 'capacity'));
        $top = collect($rows)->sortByDesc('hours')->take(10)->values();

        return [
            'summary' => [
                $this->card('Ledolgozott óra', $hoursTotal, 'num'),
                $this->card('Kapacitás (óra)', $capacityTotal, 'num'),
                $this->card('Átlagos kihasználtság', $capacityTotal > 0 ? round($hoursTotal / $capacityTotal * 100, 1) : null, 'pct'),
                $this->card('Munkanap az időszakban', $workdays, 'num'),
            ],
            'columns' => [
                $this->col('name', 'Munkatárs', 'text'),
                $this->col('job_title', 'Beosztás', 'text'),
                $this->col('hours', 'Ledolgozott óra', 'num'),
                $this->col('days', 'Munkával töltött nap', 'num'),
                $this->col('absence_days', 'Távollét (munkanap)', 'num'),
                $this->col('capacity', 'Kapacitás (óra)', 'num'),
                $this->col('usage', 'Kihasználtság', 'pct'),
                $this->col('projects', 'Projektek', 'num'),
            ],
            'rows' => $rows,
            'totals' => [
                'name' => 'Összesen',
                'job_title' => '',
                'hours' => round($hoursTotal, 1),
                'days' => array_sum(array_column($rows, 'days')),
                'absence_days' => array_sum(array_column($rows, 'absence_days')),
                'capacity' => $capacityTotal,
                'usage' => $capacityTotal > 0 ? round($hoursTotal / $capacityTotal * 100, 1) : null,
                'projects' => '',
            ],
            'chart' => $top->isEmpty() ? null : [
                'title' => 'Ledolgozott óra munkatársanként (10 legtöbb)',
                'labels' => $top->pluck('name')->all(),
                'series' => [[
                    'label' => 'Óra',
                    'format' => 'num',
                    'values' => $top->pluck('hours')->map(fn ($v) => (float) $v)->all(),
                ]],
            ],
            'note' => 'A kapacitás az időszak munkanapjaiból (ünnepnapok nélkül) számolódik, napi 8 órával, '
                .'a rögzített távollétekkel csökkentve. Az órák a munkatársak saját munkaidő-bejegyzéseiből jönnek.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function machineUsage(): array
    {
        [$from, $to] = $this->rangeOrCurrentYear();
        $periodDays = (int) floor($from->startOfDay()->diffInDays($to->startOfDay())) + 1;
        $scoped = $this->projectFilter !== null;

        $machines = Machine::query()->orderBy('name')->get(['id', 'name', 'kind', 'status']);

        $bookings = MachineBooking::query()
            ->overlapping($from->toDateString(), $to->toDateString())
            ->when($scoped, fn ($q) => $q->whereIn('project_id', $this->scopeIds()))
            ->get()
            ->groupBy('machine_id');

        $rows = [];
        foreach ($machines as $machine) {
            $machineBookings = $bookings->get($machine->id, collect());

            // Naphalmaz, hogy az átfedő foglalások ne számítsanak duplán.
            $days = [];
            $projects = [];
            foreach ($machineBookings as $booking) {
                $start = CarbonImmutable::parse(max($booking->starts_on->toDateString(), $from->toDateString()));
                $end = CarbonImmutable::parse(min($booking->ends_on->toDateString(), $to->toDateString()));
                for ($day = $start; $day->lte($end); $day = $day->addDay()) {
                    $days[$day->toDateString()] = true;
                }
                $projects[$booking->project_id] = true;
            }

            $bookedDays = count($days);

            $rows[] = [
                'name' => $machine->name,
                'kind' => Machines::KINDS[$machine->kind] ?? $machine->kind,
                'status' => Machines::STATUSES[$machine->status] ?? $machine->status,
                'bookings' => $machineBookings->count(),
                'booked_days' => $bookedDays,
                'period_days' => $periodDays,
                'usage' => $periodDays > 0 ? round($bookedDays / $periodDays * 100, 1) : null,
                'projects' => count($projects),
                '_link' => route('machines.show', $machine->id),
            ];
        }

        $bookedTotal = array_sum(array_column($rows, 'booked_days'));
        $capacityTotal = $periodDays * max(count($rows), 1);
        $top = collect($rows)->sortByDesc('booked_days')->take(10)->values();

        return [
            'summary' => [
                $this->card('Gép', count($rows), 'num'),
                $this->card('Lefoglalt nap', $bookedTotal, 'num'),
                $this->card('Átlagos kihasználtság', $capacityTotal > 0 ? round($bookedTotal / $capacityTotal * 100, 1) : null, 'pct'),
                $this->card('Időszak (nap)', $periodDays, 'num'),
            ],
            'columns' => [
                $this->col('name', 'Gép', 'text'),
                $this->col('kind', 'Típus', 'text'),
                $this->col('status', 'Állapot', 'text'),
                $this->col('bookings', 'Foglalás', 'num'),
                $this->col('booked_days', 'Lefoglalt nap', 'num'),
                $this->col('period_days', 'Időszak (nap)', 'num'),
                $this->col('usage', 'Kihasználtság', 'pct'),
                $this->col('projects', 'Projektek', 'num'),
            ],
            'rows' => $rows,
            'chart' => $top->isEmpty() ? null : [
                'title' => 'Lefoglalt napok gépenként (10 legtöbb)',
                'labels' => $top->pluck('name')->all(),
                'series' => [[
                    'label' => 'Nap',
                    'format' => 'num',
                    'values' => $top->pluck('booked_days')->map(fn ($v) => (float) $v)->all(),
                ]],
            ],
            'note' => 'A kihasználtság a gépfoglalások naptári napjaiból számolódik; az átfedő foglalások '
                .'egy napnak számítanak. A foglalások az Ütemezés naptárban is látszanak.',
        ];
    }

    /* ================================================================== */
    /* 5) Alvállalkozói statisztika */
    /* ================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function subcontractorStats(): array
    {
        $scoped = $this->projectFilter !== null;
        $scopeIds = $this->scopeIds();

        $costs = ProjectCost::query()
            ->where('category', 'alvallalkozo')
            ->whereNotNull('partner_id')
            ->when($scoped, fn ($q) => $q->whereIn('project_id', $scopeIds))
            ->when($this->from, fn ($q) => $q->whereDate('incurred_on', '>=', $this->from->toDateString()))
            ->when($this->to, fn ($q) => $q->whereDate('incurred_on', '<=', $this->to->toDateString()))
            ->selectRaw('partner_id, sum(amount) as v, count(*) as c')
            ->groupBy('partner_id')
            ->get()
            ->keyBy('partner_id');

        $assignments = DB::table('project_subcontractors')
            ->when($scoped, fn ($q) => $q->whereIn('project_id', $scopeIds))
            ->selectRaw('partner_id, count(*) as c')
            ->groupBy('partner_id')
            ->pluck('c', 'partner_id');

        $ratings = SubcontractorRating::query()
            ->selectRaw('partner_id, avg(score) as a, count(*) as c')
            ->groupBy('partner_id')
            ->get()
            ->keyBy('partner_id');

        $expiring = SubcontractorCertification::query()
            ->whereNotNull('valid_until')
            ->whereDate('valid_until', '<=', CarbonImmutable::today()->addDays(30)->toDateString())
            ->selectRaw('partner_id, count(*) as c')
            ->groupBy('partner_id')
            ->pluck('c', 'partner_id');

        $rows = Partner::query()
            ->where('is_subcontractor', true)
            ->orderBy('name')
            ->get(['id', 'name', 'trade'])
            ->map(function (Partner $partner) use ($costs, $assignments, $ratings, $expiring) {
                $cost = $costs->get($partner->id);
                $rating = $ratings->get($partner->id);

                return [
                    'name' => $partner->name,
                    'trade' => $partner->trade ?: '—',
                    'projects' => (int) ($assignments[$partner->id] ?? 0),
                    'cost' => $cost ? (float) $cost->v : 0.0,
                    'items' => $cost ? (int) $cost->c : 0,
                    'rating' => $rating ? round((float) $rating->a, 1) : null,
                    'rating_count' => $rating ? (int) $rating->c : 0,
                    'expiring' => (int) ($expiring[$partner->id] ?? 0),
                    '_link' => route('subcontractors.show', $partner->id),
                    '_tone' => (int) ($expiring[$partner->id] ?? 0) > 0 ? 'warn' : null,
                ];
            })
            ->sortByDesc('cost')
            ->values();

        $costTotal = $rows->sum('cost');
        $rated = $rows->filter(fn ($r) => $r['rating'] !== null);
        $top = $rows->filter(fn ($r) => $r['cost'] > 0)->take(10)->values();

        return [
            'summary' => [
                $this->card('Alvállalkozó', $rows->count(), 'num'),
                $this->card('Elszámolt költség', $costTotal, 'huf'),
                $this->card('Átlagos értékelés', $rated->count() > 0 ? round($rated->avg('rating'), 1) : null, 'num'),
                $this->card('Lejáró dokumentum', $rows->sum('expiring'), 'num', $rows->sum('expiring') > 0 ? 'warn' : 'good'),
            ],
            'columns' => [
                $this->col('name', 'Alvállalkozó', 'text'),
                $this->col('trade', 'Szakág', 'text'),
                $this->col('projects', 'Projektek', 'num'),
                $this->col('cost', 'Elszámolt költség', 'huf'),
                $this->col('items', 'Tételek', 'num'),
                $this->col('rating', 'Értékelés', 'num'),
                $this->col('rating_count', 'Értékelések', 'num'),
                $this->col('expiring', 'Lejáró dok.', 'num'),
            ],
            'rows' => $rows->all(),
            'totals' => [
                'name' => 'Összesen',
                'trade' => '',
                'projects' => $rows->sum('projects'),
                'cost' => $costTotal,
                'items' => $rows->sum('items'),
                'rating' => $rated->count() > 0 ? round($rated->avg('rating'), 1) : null,
                'rating_count' => $rows->sum('rating_count'),
                'expiring' => $rows->sum('expiring'),
            ],
            'chart' => $top->isEmpty() ? null : [
                'title' => 'Elszámolt költség alvállalkozónként (10 legnagyobb)',
                'labels' => $top->pluck('name')->all(),
                'series' => [[
                    'label' => 'Költség',
                    'format' => 'huf',
                    'values' => $top->pluck('cost')->map(fn ($v) => (float) $v)->all(),
                ]],
            ],
            'note' => 'Az elszámolt költség a Pénzügy modulban rögzített, alvállalkozói kategóriájú tételekből jön. '
                .'A „Lejáró dok." a 30 napon belül lejáró vagy már lejárt tanúsítványok száma.',
        ];
    }

    /* ================================================================== */
    /* 6) Kintlévőségek / esedékes kifizetések */
    /* ================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function payables(): array
    {
        $today = CarbonImmutable::today();
        $scoped = $this->projectFilter !== null || $this->statusFilter !== null;

        $invoices = ProjectCost::query()
            ->where('is_invoice', true)
            ->when($scoped, fn ($q) => $q->whereIn('project_id', $this->scopeIds()))
            ->when($this->from, fn ($q) => $q->where(fn ($w) => $w
                ->whereDate('due_on', '>=', $this->from->toDateString())
                ->orWhereNull('due_on')))
            ->when($this->to, fn ($q) => $q->where(fn ($w) => $w
                ->whereDate('due_on', '<=', $this->to->toDateString())
                ->orWhereNull('due_on')))
            ->with(['project:id,code', 'partner:id,name'])
            ->orderBy('due_on')
            ->get()
            ->map(function (ProjectCost $cost) use ($today) {
                $due = $cost->due_on ? CarbonImmutable::parse($cost->due_on) : null;
                $overdue = ! $cost->is_paid && $due && $due->lt($today);

                return [
                    'code' => $cost->project?->code ?? '—',
                    'partner' => $cost->partner?->name ?? '—',
                    'description' => $cost->description,
                    'amount' => (float) $cost->amount,
                    'incurred_on' => $cost->incurred_on?->toDateString() ?? '—',
                    'due_on' => $due?->toDateString() ?? '—',
                    'age' => $overdue ? $due->diffInDays($today) : null,
                    'state' => $cost->is_paid ? 'Kifizetve' : ($overdue ? 'Lejárt' : 'Esedékes'),
                    'paid' => $cost->is_paid,
                    'overdue' => $overdue,
                    'partner_id' => $cost->partner_id,
                    'due_raw' => $due?->toDateString(),
                    '_link' => $cost->project_id ? route('finance.show', $cost->project_id) : null,
                    '_tone' => $overdue ? 'bad' : null,
                ];
            });

        $open = $invoices->where('paid', false);
        $overdue = $open->where('overdue', true);

        $summary = [
            $this->card('Nyitott számla', $open->count(), 'num'),
            $this->card('Nyitott összeg', $open->sum('amount'), 'huf'),
            $this->card('Ebből lejárt', $overdue->sum('amount'), 'huf', $overdue->count() > 0 ? 'bad' : 'good'),
            $this->card('Kifizetve', $invoices->where('paid', true)->sum('amount'), 'huf', 'good'),
        ];

        $note = 'Bejövő (szállítói/alvállalkozói) számlák a Pénzügy modulból. A kimenő (vevői) számlázás — és így '
            .'a vevői kintlévőség — a Számlázz.hu integrációval érkezik, az a fejlesztés legvégén készül el.';

        if ($this->group === 'partner') {
            $rows = $open->groupBy('partner')->map(function (Collection $group) {
                $late = $group->where('overdue', true);

                return [
                    'partner' => $group->first()['partner'],
                    'invoices' => $group->count(),
                    'amount' => $group->sum('amount'),
                    'overdue_amount' => $late->sum('amount'),
                    'oldest_due' => $group->pluck('due_raw')->filter()->min() ?? '—',
                    'max_age' => $late->max('age'),
                    '_tone' => $late->count() > 0 ? 'bad' : null,
                ];
            })->sortByDesc('amount')->values();

            return [
                'summary' => $summary,
                'columns' => [
                    $this->col('partner', 'Partner', 'text'),
                    $this->col('invoices', 'Nyitott számla', 'num'),
                    $this->col('amount', 'Nyitott összeg', 'huf'),
                    $this->col('overdue_amount', 'Ebből lejárt', 'huf'),
                    $this->col('oldest_due', 'Legkorábbi esedékesség', 'date'),
                    $this->col('max_age', 'Legrégebbi lejárat', 'days'),
                ],
                'rows' => $rows->all(),
                'totals' => [
                    'partner' => 'Összesen',
                    'invoices' => $rows->sum('invoices'),
                    'amount' => $rows->sum('amount'),
                    'overdue_amount' => $rows->sum('overdue_amount'),
                    'oldest_due' => '',
                    'max_age' => null,
                ],
                'note' => $note,
            ];
        }

        return [
            'summary' => $summary,
            'columns' => [
                $this->col('code', 'Projekt', 'text'),
                $this->col('partner', 'Partner', 'text'),
                $this->col('description', 'Megnevezés', 'text'),
                $this->col('amount', 'Összeg', 'huf'),
                $this->col('incurred_on', 'Kelte', 'date'),
                $this->col('due_on', 'Esedékesség', 'date'),
                $this->col('age', 'Lejárt (nap)', 'days'),
                $this->col('state', 'Állapot', 'text'),
            ],
            'rows' => $invoices->all(),
            'totals' => [
                'code' => '',
                'partner' => '',
                'description' => 'Összesen',
                'amount' => $invoices->sum('amount'),
                'incurred_on' => '',
                'due_on' => '',
                'age' => null,
                'state' => '',
            ],
            'note' => $note,
        ];
    }

    /* ================================================================== */
    /* 7) Minőségi / munkavédelmi statisztika */
    /* ================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function quality(): array
    {
        $today = CarbonImmutable::today();
        $ids = $this->scopeIds();

        $defects = Defect::query()
            ->whereIn('project_id', $ids)
            ->when($this->from, fn ($q) => $q->whereDate('created_at', '>=', $this->from->toDateString()))
            ->when($this->to, fn ($q) => $q->whereDate('created_at', '<=', $this->to->toDateString()))
            ->with('project:id,code,parent_id')
            ->get();

        $inspections = Inspection::query()
            ->whereIn('project_id', $ids)
            ->when($this->from, fn ($q) => $q->whereDate('inspected_on', '>=', $this->from->toDateString()))
            ->when($this->to, fn ($q) => $q->whereDate('inspected_on', '<=', $this->to->toDateString()))
            ->withCount([
                'items as failed_items' => fn ($q) => $q->where('result', 'nem_megfelelt'),
            ])
            ->with('project:id,code')
            ->get();

        $safety = SafetyRecord::query()
            ->whereIn('project_id', $ids)
            ->when($this->from, fn ($q) => $q->whereDate('occurred_on', '>=', $this->from->toDateString()))
            ->when($this->to, fn ($q) => $q->whereDate('occurred_on', '<=', $this->to->toDateString()))
            ->with('project:id,code')
            ->get();

        $openDefects = $defects->where('status', '!=', 'lezart');
        $overdue = $openDefects->filter(fn (Defect $d) => $d->isOverdue());

        $summary = [
            $this->card('Hiba összesen', $defects->count(), 'num'),
            $this->card('Nyitott hiba', $openDefects->count(), 'num', $openDefects->count() > 0 ? 'warn' : 'good'),
            $this->card('Lejárt határidejű', $overdue->count(), 'num', $overdue->count() > 0 ? 'bad' : 'good'),
            $this->card('Ellenőrzés', $inspections->count(), 'num'),
        ];

        if ($this->group === 'sulyossag') {
            $rows = [];
            foreach (Qa::SEVERITIES as $key => $label) {
                $group = $defects->where('severity', $key);
                $open = $group->where('status', '!=', 'lezart');

                $rows[] = [
                    'severity' => $label,
                    'total' => $group->count(),
                    'open' => $group->where('status', 'nyitott')->count(),
                    'in_progress' => $group->where('status', 'javitas_alatt')->count(),
                    'closed' => $group->where('status', 'lezart')->count(),
                    'overdue' => $group->filter(fn (Defect $d) => $d->isOverdue())->count(),
                    'avg_age' => $open->count() > 0
                        ? round($open->avg(fn (Defect $d) => max(
                            0,
                            (int) floor(CarbonImmutable::parse($d->created_at)->startOfDay()->diffInDays($today)),
                        )), 1)
                        : null,
                    '_tone' => $key === 'magas' && $open->count() > 0 ? 'bad' : null,
                ];
            }

            return [
                'summary' => $summary,
                'columns' => [
                    $this->col('severity', 'Súlyosság', 'text'),
                    $this->col('total', 'Hiba', 'num'),
                    $this->col('open', 'Nyitott', 'num'),
                    $this->col('in_progress', 'Javítás alatt', 'num'),
                    $this->col('closed', 'Lezárt', 'num'),
                    $this->col('overdue', 'Lejárt', 'num'),
                    $this->col('avg_age', 'Nyitott hibák átlagos kora', 'days'),
                ],
                'rows' => $rows,
                'totals' => [
                    'severity' => 'Összesen',
                    'total' => $defects->count(),
                    'open' => $defects->where('status', 'nyitott')->count(),
                    'in_progress' => $defects->where('status', 'javitas_alatt')->count(),
                    'closed' => $defects->where('status', 'lezart')->count(),
                    'overdue' => $overdue->count(),
                    'avg_age' => null,
                ],
                'chart' => [
                    'title' => 'Hibák súlyosság szerint',
                    'labels' => array_column($rows, 'severity'),
                    'series' => [
                        ['label' => 'Nyitott', 'format' => 'num', 'values' => array_map(fn ($r) => (float) ($r['open'] + $r['in_progress']), $rows)],
                        ['label' => 'Lezárt', 'format' => 'num', 'values' => array_map(fn ($r) => (float) $r['closed'], $rows)],
                    ],
                ],
                'note' => 'A hibák az időszakban RÖGZÍTETT bejegyzések. A nyitott hibák kora a rögzítés óta eltelt idő.',
            ];
        }

        $projects = $this->mainProjects()->get();
        $rows = [];
        foreach ($projects as $project) {
            $projectIds = array_merge([$project->id], $project->subprojects->pluck('id')->all());
            $group = $defects->whereIn('project_id', $projectIds);
            $projectInspections = $inspections->whereIn('project_id', $projectIds);
            $projectSafety = $safety->whereIn('project_id', $projectIds);

            if ($group->isEmpty() && $projectInspections->isEmpty() && $projectSafety->isEmpty()) {
                continue;
            }

            $projectOverdue = $group->filter(fn (Defect $d) => $d->isOverdue())->count();

            $rows[] = [
                'code' => $project->code,
                'name' => $project->name,
                'defects' => $group->count(),
                'open' => $group->where('status', '!=', 'lezart')->count(),
                'high' => $group->where('severity', 'magas')->count(),
                'overdue' => $projectOverdue,
                'inspections' => $projectInspections->count(),
                'failed' => (int) $projectInspections->sum('failed_items'),
                'safety' => $projectSafety->count(),
                'accidents' => $projectSafety->where('type', 'baleset')->count(),
                '_link' => route('qa.index', ['project' => $project->id]),
                '_tone' => $projectOverdue > 0 || $projectSafety->where('type', 'baleset')->count() > 0 ? 'bad' : null,
            ];
        }

        return [
            'summary' => $summary,
            'columns' => [
                $this->col('code', 'Kód', 'text'),
                $this->col('name', 'Projekt', 'text'),
                $this->col('defects', 'Hiba', 'num'),
                $this->col('open', 'Nyitott', 'num'),
                $this->col('high', 'Magas súlyosságú', 'num'),
                $this->col('overdue', 'Lejárt', 'num'),
                $this->col('inspections', 'Ellenőrzés', 'num'),
                $this->col('failed', 'Nem megfelelt tétel', 'num'),
                $this->col('safety', 'Munkavédelmi bejegyzés', 'num'),
                $this->col('accidents', 'Baleset', 'num'),
            ],
            'rows' => $rows,
            'totals' => [
                'code' => '',
                'name' => 'Összesen',
                'defects' => array_sum(array_column($rows, 'defects')),
                'open' => array_sum(array_column($rows, 'open')),
                'high' => array_sum(array_column($rows, 'high')),
                'overdue' => array_sum(array_column($rows, 'overdue')),
                'inspections' => array_sum(array_column($rows, 'inspections')),
                'failed' => array_sum(array_column($rows, 'failed')),
                'safety' => array_sum(array_column($rows, 'safety')),
                'accidents' => array_sum(array_column($rows, 'accidents')),
            ],
            'note' => 'A hibák a rögzítés dátuma, az ellenőrzések az ellenőrzés napja, a munkavédelmi bejegyzések '
                .'az esemény napja szerint kerülnek az időszakba.',
        ];
    }

    /* ================================================================== */
    /* 8) Időszaki összesítő (havi / negyedéves / éves) */
    /* ================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function periodic(): array
    {
        [$from, $to] = $this->rangeOrCurrentYear();
        $ids = $this->scopeIds();

        $months = $this->monthKeys($from, $to);

        $material = $this->monthlySum(
            $this->materialQuery($ids, $from, $to),
            'coalesce(received_on, ordered_on, expected_on)',
            'quantity * unit_price',
        );
        $costs = $this->monthlySum(
            ProjectCost::whereIn('project_id', $ids)
                ->whereBetween('incurred_on', [$from->toDateString(), $to->toDateString()]),
            'incurred_on',
            'amount',
        );
        $hours = $this->monthlySum(
            WorkLog::whereIn('project_id', $ids)
                ->whereBetween('work_date', [$from->toDateString(), $to->toDateString()]),
            'work_date',
            'hours',
        );
        $phases = $this->monthlyCount(
            ProjectPhase::whereIn('project_id', $ids)
                ->whereNotNull('completed_on')
                ->whereBetween('completed_on', [$from->toDateString(), $to->toDateString()]),
            'completed_on',
        );
        $defects = $this->monthlyCount(
            Defect::whereIn('project_id', $ids)
                ->whereBetween('created_at', [$from->startOfDay(), $to->endOfDay()]),
            'created_at',
        );
        $reports = $this->monthlyCount(
            DB::table('daily_reports')->whereIn('project_id', $ids)->whereNull('deleted_at')
                ->whereBetween('report_date', [$from->toDateString(), $to->toDateString()]),
            'report_date',
        );

        $buckets = [];
        foreach ($months as $month) {
            $bucket = $this->bucketKey($month);
            $buckets[$bucket] ??= [
                'period' => $this->bucketLabel($bucket),
                'material' => 0.0,
                'other' => 0.0,
                'cost' => 0.0,
                'hours' => 0.0,
                'phases' => 0,
                'defects' => 0,
                'reports' => 0,
            ];

            $mat = (float) ($material[$month] ?? 0);
            $other = (float) ($costs[$month] ?? 0);

            $buckets[$bucket]['material'] += $mat;
            $buckets[$bucket]['other'] += $other;
            $buckets[$bucket]['cost'] += $mat + $other;
            $buckets[$bucket]['hours'] += (float) ($hours[$month] ?? 0);
            $buckets[$bucket]['phases'] += (int) ($phases[$month] ?? 0);
            $buckets[$bucket]['defects'] += (int) ($defects[$month] ?? 0);
            $buckets[$bucket]['reports'] += (int) ($reports[$month] ?? 0);
        }

        $rows = array_values($buckets);

        return [
            'summary' => [
                $this->card('Összes költség', array_sum(array_column($rows, 'cost')), 'huf'),
                $this->card('Anyagköltség', array_sum(array_column($rows, 'material')), 'huf'),
                $this->card('Ledolgozott óra', array_sum(array_column($rows, 'hours')), 'num'),
                $this->card('Lezárt fázis', array_sum(array_column($rows, 'phases')), 'num'),
            ],
            'columns' => [
                $this->col('period', 'Időszak', 'text'),
                $this->col('material', 'Anyagköltség', 'huf'),
                $this->col('other', 'Egyéb költség (nem anyag)', 'huf'),
                $this->col('cost', 'Összes költség', 'huf'),
                $this->col('hours', 'Ledolgozott óra', 'num'),
                $this->col('phases', 'Lezárt fázis', 'num'),
                $this->col('defects', 'Új hiba', 'num'),
                $this->col('reports', 'Napi jelentés', 'num'),
            ],
            'rows' => $rows,
            'totals' => [
                'period' => 'Összesen',
                'material' => array_sum(array_column($rows, 'material')),
                'other' => array_sum(array_column($rows, 'other')),
                'cost' => array_sum(array_column($rows, 'cost')),
                'hours' => round(array_sum(array_column($rows, 'hours')), 1),
                'phases' => array_sum(array_column($rows, 'phases')),
                'defects' => array_sum(array_column($rows, 'defects')),
                'reports' => array_sum(array_column($rows, 'reports')),
            ],
            'chart' => $rows === [] ? null : [
                'title' => 'Költség időszakonként',
                'labels' => array_column($rows, 'period'),
                'series' => [
                    ['label' => 'Anyag', 'format' => 'huf', 'values' => array_map('floatval', array_column($rows, 'material'))],
                    ['label' => 'Egyéb', 'format' => 'huf', 'values' => array_map('floatval', array_column($rows, 'other'))],
                ],
            ],
            'note' => 'Az anyagköltség a beérkezés (ill. megrendelés) dátuma szerint, az egyéb költség a felmerülés '
                .'dátuma szerint kerül az időszakba.',
        ];
    }

    /* ================================================================== */
    /* Segédfüggvények */
    /* ================================================================== */

    /**
     * A szűrésnek megfelelő fő projektek (alprojekt és megrendelő betöltve).
     */
    private function mainProjects(): Builder
    {
        return Project::query()
            ->whereNull('parent_id')
            ->when($this->projectFilter, fn ($q) => $q->where('id', $this->projectFilter))
            ->when($this->statusFilter, fn ($q) => $q->where('status', $this->statusFilter))
            ->with(['subprojects:id,parent_id', 'client:id,name'])
            ->orderBy('code');
    }

    /**
     * A szűrésnek megfelelő ÖSSZES projekt-id (fő + alprojektek).
     *
     * @return array<int, int>
     */
    private function scopeIds(): array
    {
        if ($this->scopeIds !== null) {
            return $this->scopeIds;
        }

        $mains = Project::query()
            ->whereNull('parent_id')
            ->when($this->projectFilter, fn ($q) => $q->where('id', $this->projectFilter))
            ->when($this->statusFilter, fn ($q) => $q->where('status', $this->statusFilter))
            ->pluck('id')->all();

        $subs = Project::whereIn('parent_id', $mains)->pluck('id')->all();

        return $this->scopeIds = array_merge($mains, $subs);
    }

    /**
     * Anyagbeszerzés-lekérdezés a kötelezettséget jelentő tételekre, időszakkal.
     *
     * @param  array<int, int>  $ids
     */
    private function materialQuery(array $ids, ?CarbonImmutable $from = null, ?CarbonImmutable $to = null): Builder
    {
        $from ??= $this->from;
        $to ??= $this->to;

        return MaterialProcurement::committed()
            ->whereIn('project_id', $ids)
            ->when($from, fn ($q) => $q->whereRaw('coalesce(received_on, ordered_on, expected_on) >= ?', [$from->toDateString()]))
            ->when($to, fn ($q) => $q->whereRaw('coalesce(received_on, ordered_on, expected_on) <= ?', [$to->toDateString()]));
    }

    /**
     * Költség-lekérdezés időszakkal (felmerülés dátuma szerint).
     *
     * @param  array<int, int>  $ids
     */
    private function costQuery(array $ids): Builder
    {
        return ProjectCost::query()
            ->whereIn('project_id', $ids)
            ->when($this->from, fn ($q) => $q->whereDate('incurred_on', '>=', $this->from->toDateString()))
            ->when($this->to, fn ($q) => $q->whereDate('incurred_on', '<=', $this->to->toDateString()));
    }

    /**
     * Projekt+kategória bontású költség-összegek.
     *
     * @param  array<int, int>  $ids
     * @return array<int, array<string, float>>
     */
    private function costsByProjectAndCategory(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $map = [];
        foreach (ProjectCost::whereIn('project_id', $ids)
            ->selectRaw('project_id, category, sum(amount) as v')
            ->groupBy('project_id', 'category')->get() as $row) {
            $map[$row->project_id][$row->category] = (float) $row->v;
        }

        return $map;
    }

    /**
     * @param  Builder  $query
     * @return array<int, float>
     */
    private function sumBy($query, string $keyColumn, string $expression): array
    {
        return $query->selectRaw("{$keyColumn}, sum({$expression}) as v")
            ->groupBy($keyColumn)
            ->pluck('v', $keyColumn)
            ->map(fn ($v) => (float) $v)
            ->all();
    }

    /**
     * Havi bontású összeg (kulcs: YYYY-MM).
     *
     * @return array<string, float>
     */
    private function monthlySum($query, string $dateExpression, string $valueExpression): array
    {
        return collect($query
            ->selectRaw("to_char({$dateExpression}, 'YYYY-MM') as m, sum({$valueExpression}) as v")
            ->groupByRaw("to_char({$dateExpression}, 'YYYY-MM')")
            ->get())
            ->mapWithKeys(fn ($row) => [(string) $row->m => (float) $row->v])
            ->all();
    }

    /**
     * Havi bontású darabszám (kulcs: YYYY-MM).
     *
     * @return array<string, int>
     */
    private function monthlyCount($query, string $dateExpression): array
    {
        return collect($query
            ->selectRaw("to_char({$dateExpression}, 'YYYY-MM') as m, count(*) as v")
            ->groupByRaw("to_char({$dateExpression}, 'YYYY-MM')")
            ->get())
            ->mapWithKeys(fn ($row) => [(string) $row->m => (int) $row->v])
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function monthKeys(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $keys = [];
        for ($month = $from->startOfMonth(); $month->lte($to); $month = $month->addMonth()) {
            $keys[] = $month->format('Y-m');
        }

        return $keys;
    }

    private function bucketKey(string $month): string
    {
        [$year, $m] = explode('-', $month);

        return match ($this->group) {
            'ev' => $year,
            'negyedev' => $year.'-Q'.(int) ceil((int) $m / 3),
            default => $month,
        };
    }

    private function bucketLabel(string $bucket): string
    {
        if (str_contains($bucket, '-Q')) {
            [$year, $quarter] = explode('-', $bucket);

            return "{$year}. {$quarter}";
        }

        if (str_contains($bucket, '-')) {
            [$year, $month] = explode('-', $bucket);

            return "{$year}. {$month}.";
        }

        return "{$bucket}.";
    }

    /**
     * Ha nincs megadva időszak, az idei év a vizsgált tartomány.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function rangeOrCurrentYear(): array
    {
        $today = CarbonImmutable::today();

        return [
            $this->from ?? $today->startOfYear(),
            $this->to ?? $today->endOfYear(),
        ];
    }

    /**
     * @param  array<int, float>  $map
     * @param  array<int, int>  $ids
     */
    private function pick(array $map, array $ids): float
    {
        $sum = 0.0;
        foreach ($ids as $id) {
            $sum += $map[$id] ?? 0;
        }

        return $sum;
    }

    /**
     * @param  array<int, array<string, float>>  $map
     * @param  array<int, int>  $ids
     */
    private function pickCategory(array $map, array $ids, string $category): float
    {
        $sum = 0.0;
        foreach ($ids as $id) {
            $sum += $map[$id][$category] ?? 0;
        }

        return $sum;
    }

    /**
     * @param  array<int, float>  $map
     * @param  array<int, int>  $ids
     */
    private function max(array $map, array $ids): float
    {
        $max = 0.0;
        foreach ($ids as $id) {
            $max = max($max, $map[$id] ?? 0);
        }

        return $max;
    }

    /**
     * @return array{key:string,label:string,align:string,format:string}
     */
    private function col(string $key, string $label, string $format): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'format' => $format,
            'align' => $format === 'text' ? 'left' : 'right',
        ];
    }

    /**
     * @return array{label:string,value:mixed,format:string,tone:?string}
     */
    private function card(string $label, mixed $value, string $format, ?string $tone = null): array
    {
        return ['label' => $label, 'value' => $value, 'format' => $format, 'tone' => $tone];
    }
}
