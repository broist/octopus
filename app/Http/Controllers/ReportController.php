<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\ReportBuilder;
use App\Services\ReportExport;
use App\Support\Reports;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Riportok / Statisztikák (spec §15) — a többi modul adataiból készülő
 * elemző kimutatások a cégvezetéshez.
 *
 * A fix riportok listája a {@see Reports} katalógusban van, a számítás a
 * {@see ReportBuilder}-ben. A nézet testre szabható: időszak, projekt, státusz,
 * bontás és látható oszlopok — az export (CSV/PDF) ugyanezt a beállítást viszi.
 */
class ReportController extends Controller
{
    public function index(Request $request, string $report = Reports::DEFAULT_KEY): Response
    {
        abort_unless(Reports::exists($report), 404);

        $filters = $this->filters($request, $report);

        return Inertia::render('Reports/Index', [
            'report' => ReportBuilder::build($report, $filters),
            'definition' => Reports::definition($report),
            'tabs' => Reports::tabs(),
            'filters' => $filters,
            'periods' => Reports::PERIODS,
            'statuses' => Project::STATUSES,
            'projects' => Project::query()
                ->whereNull('parent_id')
                ->orderBy('code')
                ->get(['id', 'code', 'name'])
                ->map(fn (Project $p) => ['id' => $p->id, 'label' => "{$p->code} – {$p->name}"]),
        ]);
    }

    /**
     * Ugyanaz a riport CSV-ben (Excel) vagy PDF-ben, a képernyőn beállított
     * szűrőkkel és a látható oszlopokkal.
     */
    public function export(Request $request, string $report): SymfonyResponse
    {
        abort_unless(Reports::exists($report), 404);

        $format = $request->string('format')->toString() === 'pdf' ? 'pdf' : 'csv';
        $filters = $this->filters($request, $report);
        $data = ReportBuilder::build($report, $filters);

        // Csak a képernyőn is látható oszlopok kerülnek az exportba.
        $visible = array_filter(explode(',', $request->string('columns')->toString()));
        if ($visible !== []) {
            $data['columns'] = array_values(array_filter(
                $data['columns'],
                fn ($column) => in_array($column['key'], $visible, true),
            ));
        }

        $meta = $this->metaLines($data, $filters);
        $filename = $report.'-'.now()->format('Ymd-Hi').'.'.$format;

        $content = $format === 'pdf'
            ? ReportExport::pdf($data, $meta)
            : ReportExport::csv($data, $meta);

        return response($content, 200, [
            'Content-Type' => $format === 'pdf' ? 'application/pdf' : 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function filters(Request $request, string $report): array
    {
        $definition = Reports::definition($report);
        $period = $request->string('period')->toString();

        if (! array_key_exists($period, Reports::PERIODS)) {
            $period = $definition['default_period'];
        }

        $group = $request->string('group')->toString();
        if (! array_key_exists($group, $definition['groups'])) {
            $group = $definition['default_group'];
        }

        $status = $request->string('status')->toString();
        if (! array_key_exists($status, Project::STATUSES)) {
            $status = '';
        }

        return [
            'period' => $period,
            'from' => $this->date($request->string('from')->toString()),
            'to' => $this->date($request->string('to')->toString()),
            'project' => $request->integer('project') ?: null,
            'status' => $status,
            'group' => $group,
        ];
    }

    /**
     * Dátum-paraméter normalizálása (hibás értékre nincs szűrés, nem hiba).
     */
    private function date(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Az exportok fejlécébe kerülő, ember által olvasható szűrő-összefoglaló.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $filters
     * @return array<int, string>
     */
    private function metaLines(array $data, array $filters): array
    {
        $lines = [];

        $from = $data['range']['from'];
        $to = $data['range']['to'];
        $lines[] = 'Időszak: '.($from || $to
            ? ($from ?? '…').' – '.($to ?? '…')
            : Reports::PERIODS['minden']);

        if ($filters['project']) {
            $project = Project::find($filters['project']);
            if ($project) {
                $lines[] = 'Projekt: '.$project->code.' – '.$project->name;
            }
        }

        if ($filters['status'] !== '') {
            $lines[] = 'Státusz: '.(Project::STATUSES[$filters['status']] ?? $filters['status']);
        }

        $definition = Reports::definition($data['key']);
        if ($data['group'] !== '' && isset($definition['groups'][$data['group']])) {
            $lines[] = 'Bontás: '.$definition['groups'][$data['group']];
        }

        $lines[] = 'Készítette: '.(request()->user()?->name ?? '');

        return $lines;
    }
}
